module.exports = function(grunt) {
    
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	
    // Project configuration.
    var project = {
        files: [
            "src/range-extensions.js",
            "src/basic-object-model.js",
            "src/task-scheduler.js",
            "src/css-syntax.js",
            "src/css-cascade.js",
            "src/css-selectors.js",
            "src/css-break.js",
            "src/css-regions-helpers.js",
            "src/css-regions.js",
            "src/css-regions-objectmodel.js",
        ]
    }
    
    grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      
      concat: {
          dist: {
              src: project.files,
              dest: '<%= pkg.name %>.js'
          }
      },
      
      uglify: {
          dist: {
          options: {
              // apply banner to uglifyified file because Uglify removes all comments.
			  banner: '/*! Copyright 2012 <%= pkg.author.name %>;\n' +
					  '* Licensed under the Apache License, Version 2.0 (the "License");\n' +
					  '* you may not use this file except in compliance with the License.\n' +
					  '* You may obtain a copy of the License at\n\n' +
					  '* http://www.apache.org/licenses/LICENSE-2.0\n\n' +
					  '* Unless required by applicable law or agreed to in writing, software\n' +
					  '* distributed under the License is distributed on an "AS IS" BASIS,\n' +
					  '* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n' +
					  '* See the License for the specific language governing permissions and\n' +
					  '* limitations under the License.\n'+
					  '*/'
              },
              src: ['<banner:meta.banner>','<%= concat.dist.dest %>'],
              dest: '<%= pkg.name %>.min.js'
          }
      },
      
      watch: {
          js: {
              files: project.files,
              tasks: ['concat', 'uglify']
          }
      }
    });
    
    grunt.registerTask('default', ['concat', 'uglify']);
    grunt.registerTask('build', ['concat', 'uglify']);
    
};