/*
 * grunt-dps
 * https://github.com/SixDimensions/grunt-dps
 *
 * Copyright (c) 2015 Charlie Wagner
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        '<%= nodeunit.tests %>'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    // Before generating any new files, remove any previously-created files.
    clean: {
      tests: ['tmp']
    },

    // Configuration to be run (and then tested).
    dps: {
      options: {
        config: {
          "publication_id": "cd9463b5-a779-4a32-b488-462ffa1cf17a",
          "device_id": "***REMOVED***",
          "device_secret": "***REMOVED***",
          "client_id": "***REMOVED***",
          "client_secret": "***REMOVED***",
          "access_token": "***REMOVED***",
          "refresh_token": "***REMOVED***",
          "expires_in": 86399986,
          "token_time": 1442850671114
        }
      },
      main: {
        options: {
          /*putArticle: {
            entityName: 'completelynew',
            title: 'what??'
          },
          putArticleImage: {
            entityName: 'completelynew',
            imagePath: 'creativecloud_small.png'
          },
          uploadArticle: {
            entityName: 'completelynew',
            articlePath: 'login.article'
          },*/
          addArticleToCollection: {
            articleName: 'completelynew',
            collectionName: 'Itineraries'
          },
          publish: {
            entities: [
              "article/completelynew",
              "collection/Itineraries"
            ]
          }
        }
      }
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js']
    }

  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['clean', 'dps', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);

};
