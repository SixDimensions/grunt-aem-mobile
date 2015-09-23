/*
 * grunt-dps
 * https://github.com/SixDimensions/grunt-dps
 *
 * Copyright (c) 2015 Charlie Wagner
 * Licensed under the MIT license.
 */

'use strict';

var dpsUtils = require('./utils.js');
var Q = require('q');
var _ = require('lodash');
var path = require('path');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('dps', 'Grunt automation for Adobe DPS 2015 api tasks.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options();
    var done = this.async();

    var deferred = Q.defer();
    var promise = deferred.promise;

    // access token
    promise.then(function(api) {
      var deferred = Q.defer();
      if (typeof options.config.access_token === 'undefined') {
        dpsUtils.getAccessToken(api, function(data) {
          api.access_token = data.access_token;
          deferred.resolve(api);
        });
      }
      else {
        deferred.resolve(api);
      }
      return deferred.promise;
    })
    // PUT article
    .then(function(api) {
      var deferred = Q.defer();
      if (typeof options.putArticle === 'undefined') {
        deferred.resolve(api);
      }
      else {
        dpsUtils.getArticle(api, options.putArticle.entityName, function(article) {
          if (article.code === 'EntityNotFoundException') {
            article = options.putArticle;
          }
          else {
            article = _.merge(article, options.putArticle);
          }
          dpsUtils.putArticle(api, article, function(response) {
            console.log('Article '+article.entityName+' was updated.');
            deferred.resolve(api);
          });
        });
      }
      return deferred.promise;
    })
    // PUT article image
    .then(function(api) {
      var deferred = Q.defer();
      if (typeof options.putArticleImage === 'undefined') {
        deferred.resolve(api);
      }
      else {
        dpsUtils.getArticle(api, options.putArticleImage.entityName, function(article) {
          if (article.code === 'EntityNotFoundException') {
            deferred.reject(new Error('Entity was not found'));
            return;
          }
          dpsUtils.putArticleImage(api, article, path.resolve(options.putArticleImage.imagePath), function(result) {
            console.log('Article Image for '+result.entityName+' was uploaded and sealed.');
            deferred.resolve(api);
          });
        });
      }
      return deferred.promise;
    })
    // PUT article file
    .then(function(api) {
      var deferred = Q.defer();
      if (typeof options.uploadArticle === 'undefined') {
        deferred.resolve(api);
      }
      else {
        dpsUtils.uploadArticle(api, options.uploadArticle.entityName, options.uploadArticle.articlePath, function(result) {
          console.log('Article file for '+options.uploadArticle.entityName+' uploaded.');
          deferred.resolve(api);
        });
      }
      return deferred.promise;
    })
    // PUT article into collection
    .then(function(api) {
      var deferred = Q.defer();
      if (typeof options.addArticleToCollection === 'undefined') {
        deferred.resolve(api);
      }
      else {
        dpsUtils.addArticleToCollection(api, options.addArticleToCollection.articleName, options.addArticleToCollection.collectionName, function(result) {
          if (result.code === 'EntityNotFoundException') {
            deferred.reject(new Error('Entity was not found'));
            return;
          }
          console.log('Article '+options.addArticleToCollection.articleName+' added to the '+options.addArticleToCollection.collectionName+' collection.');
          deferred.resolve(api);
        });
      }
      return deferred.promise;
    })
    // publish
    .then(function(api) {
      var deferred = Q.defer();
      if (typeof options.publish === 'undefined') {
        deferred.resolve(api);
      }
      else {

        dpsUtils.publish(api, options.publish.entities, function(result) {
          if (result.code === 'EntityNotFoundException') {
            deferred.reject(new Error('Entity was not found'));
            return;
          }
          console.log('Entities '+options.publish.entities+' were published.');
          deferred.resolve(api);
        });
      }
      return deferred.promise;
    })
    .then(function(api) {
      console.log('done');
      done();
    }).catch(function (error) {
      console.log('error: ' + error);
      done(false);
    });
    deferred.resolve(options.config);
  });

};
