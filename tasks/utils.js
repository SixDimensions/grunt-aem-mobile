var rest = require('restler');
var jsonfile = require('jsonfile');
var uuid = require('node-uuid');
var fs = require('fs');
var _ = require('lodash');
var mimetypes = {
  png: "image/png",
  jpg: "image/jpeg"
};
var sessionId = uuid.v4();

function readApiFile(callback) {
  jsonfile.readFile('api.json', function(err, api) {
    if (err) {
      console.log(err);
      return;
    }
    callback(api);
  });
}
function standardHeaders(api, options) {
  var headers = {
    "X-DPS-Client-Version": api.client_id+'_0.0.1',
    'X-DPS-Client-Id': api.client_id,
    "X-DPS-Client-Request-Id": uuid.v4(),
    "X-DPS-Client-Session-Id": sessionId,
    "X-DPS-Api-Key": api.client_id,
    "Accept": "application/json"
  };
  for (var key in options) { 
    headers[key] = options[key]; 
  }
  return headers;
}
function request(api, type, url, options, callback) {
  var defaultOptions = {
    headers: standardHeaders(api),
    accessToken: api.access_token
  };
  rest[type](
    url,
    _.merge(defaultOptions, options)
  )
  .on('complete', function(data, other) {
    if (callback) {
      callback(data, other);
    }
  });
}
function publicationGet(api, entityUri, callback) {
  var uri = "https://pecs.publish.adobe.io/publication/"+api.publication_id+"/"+entityUri;
  request(api, 'get', uri, {}, callback);
}
function getAccessToken(api, callback) {
  rest.post(
    "https://ims-na1.adobelogin.com/ims/token/v1/?grant_type=device"+
    "&client_id="+api.client_id+
    '&client_secret='+api.client_secret+
    '&device_token='+api.device_secret+
    '&device_id='+api.device_id, 
    { // options
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  )
  .on('complete', function(data) {
    // add data to config
    api.access_token = data.access_token;
    api.refresh_token = data.refresh_token;
    api.expires_in = data.expires_in;
    api.token_time = Date.now();
    // save config back to file
    jsonfile.writeFile('api.json', api, {spaces: 2}, function(err) {
      console.log('Access token retrieved');
      if (callback) {
        callback();
      }
    });
  });
}
function uploadArticle(api, articleId, fileName, callback) {
  var articleFile = fs.statSync(fileName);
  var fileSize = articleFile["size"];
  rest.put(
    "https://ings.publish.adobe.io/publication/"+api.publication_id+"/article/"+articleId+"/contents/folio",
    { // options
      headers: standardHeaders(api, {
        "Content-Type": "application/vnd.adobe.article+zip",
        "Content-Length": fileSize
      }),
      data: fs.readFileSync(fileName),
      accessToken: api.access_token
    }
  )
  .on('complete', function(data) {
    if (callback) {
      callback(data);
    }
  });
}
function getPermissions(api, callback) {
  var uri = "https://authorization.publish.adobe.io/permissions";
  request(api, 'get', uri, {}, callback);
}
function getArticle(api, articleId, callback) {
  publicationGet(api, 'article/'+articleId, callback);
}
function getCollections(api, callback) {
  publicationGet(api, 'collection', callback);
}
function getCollection(api, collectionId, callback) {
  publicationGet(api, 'collection/'+collectionId, callback);
}
function getCollectionElements(api, collection, callback) {
  publicationGet(api, 'collection/'+collection.entityName+";version="+collection.version+"/contentElements", callback);
}
function publish(api, entityUri, callback) {
  if (typeof entityUri.length === 'undefined') {
    entityUri = [entityUri];
  }
  var body = {
    "workflowType": "publish",
    "entities": [],
    "publicationId": api.publication_id
  };
  var retrieved = 0;
  function processEntity(data) {
    if (typeof data.version !== "undefined") {
      body.entities.push("/publication/"+api.publication_id+"/"+data.entityType+"/"+data.entityName+";version="+data.version);
    }
    retrieved++;
    if (retrieved === entityUri.length) {
      var requestOptions = { data: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };
      request(api, 'post', "https://pecs.publish.adobe.io/job", requestOptions, callback);
    }
  }
  for(var i = 0; i < entityUri.length; i++) {
    publicationGet(api, entityUri[i], processEntity);
  }
}
function putArticle(api, data, callback) {
  if (typeof data.accessState === 'undefined') { 
    data.accessState = 'free';
  }
  if (typeof data.adType === 'undefined') {
    data.adType = 'static';
  }
  if (typeof data.entityType === 'undefined') {
    data.entityType = 'article';
  }
  if (typeof data.importance === 'undefined') {
    data.importance = 'normal';
  }
  if (typeof data.title === 'undefined') {
    data.title = data.entityName;
  }
  var url = "https://pecs.publish.adobe.io/publication/"+api.publication_id+"/article/"+data.entityName;
  if (data.version) {
    url+=";version="+data.version;
  }
  var requestOptions = { 
    data: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json'
    }
  };
  request(api, 'put', url, requestOptions, callback);
}
function addArticleToCollection(api, articleId, collectionId, callback) {
  getCollection(api, collectionId, function(collection) {
    if (collection.code === 'EntityNotFoundException') {
      if (callback) {
        callback(collection);
      }
      return;
    }
    getCollectionElements(api, collection, function(contentElements) {
      getArticle(api, articleId, function(article) {
        // remove previous versions of the article if they exist

        for(var i = 0; i < contentElements.length; i++) {
          if (contentElements[i].href.match('article/'+article.entityName+';')) {
            contentElements.splice(i, 1);
          }
        }
        contentElements.push( { href: '/publication/'+api.publication_id+'/article/'+article.entityName+';version='+article.version } );
        request(api, 
          'put', 
          "https://pecs.publish.adobe.io/publication/"+api.publication_id+'/collection/'+collection.entityName+";version="+collection.version+"/contentElements", 
          { 
            data: JSON.stringify(contentElements),
            headers: {
              'Content-Type': 'application/json'
            }
          }, 
          callback);
      });
    });
  });
}
function putArticleImage(api, article, imagePath, callback) {
  var imageFile = fs.statSync(imagePath);
  var fileSize = imageFile["size"];
  var uploadId = uuid.v4();
  rest.put(
    "https://pecs.publish.adobe.io"+article._links.contentUrl.href+"images/thumbnail",
    { // options
      headers: standardHeaders(api, {
        "Content-Type": mimetypes[imagePath.match(/([a-zA-Z]{3})$/)[0]],
        "Content-Length": fileSize,
        "X-DPS-Upload-Id": uploadId
      }),
      accessToken: api.access_token,
      data: fs.readFileSync(imagePath)
    }
  )
  .on('complete', function(data, response) {
    // get the most up to date article data
    getArticle(api, article.entityName, function(article) {
      // add the reference to the content we just created
      article['_links']['thumbnail'] = { href: 'contents/images/thumbnail'};
      // save it to the article
      putArticle(api, article, function(data) {
        // get the new version for the article
        getArticle(api, article.entityName, function(article) {
          // seal() the image upload
          rest.put(
            "https://pecs.publish.adobe.io/publication/"+api.publication_id+"/article/"+article.entityName+";version="+article.version+"/contents",
            {
              headers: standardHeaders(api, { 
                "X-DPS-Upload-Id": uploadId
              }),
              accessToken: api.access_token
            }
          )
          .on('complete', function(data, other) {
            if (callback) {
              callback(data);
            }
          });
        });
      });
    });
  });
}
function uploadWrapper(api, articleId) {
  getArticle(api, articleId, function(data) {
    // function to actually upload the article image and .article file
    function doUpload(data) {
      putArticleImage(api, data, 'creativecloud_small.png', function(data) {
        console.log(data);
        uploadArticle(api, articleId, function(data) {
          console.log(data);
        });
      });
    }
    if (data.code === 'EntityNotFoundException') {
      // create the article if it doesnt exist
      putArticle(api, { entityName: articleId }, function(data) {
        // now that it's created, put data into the doUpload process
        getArticle(api, articleId, doUpload);
      });
    }
    else {
      doUpload(data);
    }
  });
}

module.exports = {
  readApiFile: readApiFile,
  standardHeaders: standardHeaders,
  getAccessToken: getAccessToken,
  uploadArticle: uploadArticle,
  getPermissions: getPermissions,
  getArticle: getArticle,
  getCollections: getCollections,
  getCollection: getCollection,
  getCollectionElements: getCollectionElements,
  publish: publish,
  putArticle: putArticle,
  addArticleToCollection: addArticleToCollection,
  putArticleImage: putArticleImage,
  publicationGet: publicationGet,
  request: request
};