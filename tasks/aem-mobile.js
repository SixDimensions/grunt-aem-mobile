/*
 * grunt-aem-mobile
 * https://github.com/SixDimensions/grunt-aem-mobile
 *
 * Copyright (c) 2016 Charlie Wagner
 * Licensed under the MIT license.
 */

'use strict';

var dpsUtils;
var Q = require('q');
var _ = require('lodash');
var path = require('path');
var AEMMobileAPI = require('aem-mobile-api');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('aem-mobile', 'Grunt automation for AEM Mobile api tasks.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options();
    var done = this.async();

    var AEMMAPI = new AEMMobileAPI(options.config);
    var promise;
    if (typeof options.config.access_token === 'undefined') {
      promise = AEMMAPI.getAccessToken().then(function(data) {
        AEMMAPI.credentials.access_token = data.access_token;
      });
    }
    else {
      promise = new Q();
    }

    promise
    // get publications/applications
    .then(function() {
      if (typeof options.getPublications === 'undefined') {
        return;
      }
      else {
        return AEMMAPI.getPublications().then(function(publications) {
          console.log(publications);
        });
      }
    })
    // PUT article
    .then(function() {
      if (!options.hasOwnProperty('putArticle')) return;
      grunt.log.error("putArticle is deprecated. Please transition your Gruntfile.js to use putEntities instead.");
      return AEMMAPI.getArticle(options.putArticle.entityName)
      .then(function(article) {
        if (article.code === 'EntityNotFoundException') {
          article = options.putArticle;
        }
        else {
          article = _.merge(article, options.putArticle);
        }
        return [article, AEMMAPI.putArticle(article)];
      })
      .spread(function(article, response) {
        console.log('Article '+article.entityName+' was updated.');
      });
    })
    // PUT entities
    .then(function() {
      if (!options.hasOwnProperty('putEntities')) return;
      return Q.all(options.putEntities.map(function(entity) {
        return AEMMAPI.publicationGet(entity.entityType+"/"+entity.entityName)
        .then(function(remoteEntity) {
          if (remoteEntity.code !== 'EntityNotFoundException') {
            entity = _.merge(remoteEntity, entity);
          }
          return AEMMAPI.putEntity(entity);
        })
        .then(function(response) {
          console.log('Entity '+response.entityName+' was updated.');
          return response;
        });
      }))
      .then(function(entities) {
        console.log("Done adding entities.");
      });
    })
    // PUT article image
    .then(function() {
      if (!options.hasOwnProperty('putArticleImage') && !options.hasOwnProperty('putEntityImage')) return;
      var imageOptions;
      if (options.hasOwnProperty('putArticleImage')) {
        grunt.log.error("putArticleImage is deprecated. Please transition your Gruntfile.js to use putEntityImage instead.");
        imageOptions = options.putArticleImage;
        imageOptions.entityType = 'article';
      }
      else {
        imageOptions = options.putEntityImage;
      }
      return AEMMAPI.publicationGet(imageOptions.entityType+"/"+imageOptions.entityName)
      .then(function(entity) {
        if (entity.code === 'EntityNotFoundException') {
          throw new Error('Entity was not found');
        }
        return AEMMAPI.putEntityThumbnail(entity, path.resolve(imageOptions.imagePath));
      })
      .then(function(result) {
        if (result === false) {
          return;
        }
        console.log('Entity thumbnail for '+result.entityName+' was uploaded and sealed.');
      });
    })
    // PUT article file
    .then(function() {
      if (!options.hasOwnProperty('uploadArticle')) return;
      return AEMMAPI.uploadArticle(options.uploadArticle.entityName, options.uploadArticle.articlePath)
      .then(function(result) {
        console.log('Article file for '+options.uploadArticle.entityName+' uploaded.');
      });
    })
    // PUT entities into collection
    // deprecated
    .then(function() {
      if (!options.hasOwnProperty('addArticleToCollection')) return;
      grunt.log.error("addArticleToCollection is deprecated. Please transition your Gruntfile.js to use addEntitiesToCollections instead.");
      var collections = options.addArticleToCollection.collectionName;
      if (!Array.isArray(collections)) {
        collections = collections.split(",");
        collections.forEach(function(str, i, arr){ arr[i] = str.trim(); });
      }
      // iterate through our "add to collection" calls sequentially
      return collections.reduce(function(promise, collection) {
        // each iteration will tack a .then() call onto the promise chain
        return promise.then(function(result) {
          // if the name is valid we tack on a new and real promise
          if (collection && collection.length > 0) {
            return AEMMAPI.addArticleToCollection(options.addArticleToCollection.articleName, collection)
            .then(function(result) {
              if (result.code === 'EntityNotFoundException') {
                throw new Error('Entity was not found');
              }
              console.log('Article '+options.addArticleToCollection.articleName+' added to the '+collection+' collection.');
            });
          }
          else {
            // otherwise if the name is invalid we just pass the current promise chain on
            return promise;
          }
        });
      }, new Q());
    })
    .then(function() {
      if (!options.hasOwnProperty('addEntitiesToCollections')) return;
      var collections = options.addEntitiesToCollections.collections;
      var entities = options.addEntitiesToCollections.entities;
      if (!Array.isArray(collections)) {
        collections = collections.split(",");
        collections.forEach(function(str, i, arr){ arr[i] = str.trim(); });
      }
      if (!Array.isArray(entities)) {
        entities = entities.split(",");
        entities.forEach(function(str, i, arr){ arr[i] = str.trim(); });
      }
      return Q.all(collections.map(function(collection) {
        return AEMMAPI.addEntitiesToCollection(entities, collection)
        .then(function(result) {
          if (result.hasOwnProperty('code')) {
            throw new Error('Something went wrong: '+result);
          }
          console.log('Entities were added to the '+collection+' collection.');
        });
      }))
      .then(function(results) {
        console.log("Finished adding entities to collections.");
      });
    })
    // publish
    .then(function() {
      if (!options.hasOwnProperty('publish')) return;
      var entities = options.publish.entities;
      // cut out the junk
      for (var i = 0; i < entities.length; i++) {
        if (entities[i]) {
          entities[i] = entities[i].trim();
          if (!entities[i] || entities[i].length <= 0) {
            entities.splice(i,1); i--; continue; // remove
          }
          var tmp = entities[i].replace("collection/","").replace("article/","").trim();
          if (!tmp || tmp.length <= 0) {
            entities.splice(i,1); i--; continue; // remove
          }
        }
        else {
          entities.splice(i,1); i--; continue; // remove
        }
      }
      return AEMMAPI.publish(entities)
      .then(function(result) {
        if (result && result.hasOwnProperty('code') && result.code === 'EntityNotFoundException') {
          throw new Error('Entity was not found');
        }
        console.log('Entities '+entities+' were published.');
      });
    })
    // unpublish
    .then(function() {
      if (!options.hasOwnProperty('unpublish')) return;
      var entities = options.unpublish.entities;
      // cut out the junk
      for (var i = 0; i < entities.length; i++) {
        if (entities[i]) {
          entities[i] = entities[i].trim();
          if (!entities[i] || entities[i].length <= 0) {
            entities.splice(i,1); i--; continue; // remove
          }
          var tmp = entities[i].replace("collection/","").replace("article/","").trim();
          if (!tmp || tmp.length <= 0) {
            entities.splice(i,1); i--; continue; // remove
          }
        }
        else {
          entities.splice(i,1); i--; continue; // remove
        }
      }
      return AEMMAPI.unpublish(entities)
      .then(function(result) {
        if (result && result.hasOwnProperty('code') && result.code === 'EntityNotFoundException') {
          throw new Error('Entity was not found');
        }
        console.log('Entities '+entities+' were unpublished.');
      });
    })
    .then(function() {
      done();
    }).catch(function (error) {
      console.log('Error: ' + error);
      console.log(error.stack);
      done(false);
    });
  });

};
