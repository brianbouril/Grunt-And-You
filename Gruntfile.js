
module.exports = function(grunt) {
  grunt.initConfig({

    watch: {
      livereload: {
        options: {
          livereload: true
        },
        files: ['index.html', 'slides/*.md', 'slides/*.html', 'js/*.js', 'css/*.css']
      },
      index: {
        files: ['templates/_index.html', 'templates/_section.html', 'slides/list.json'],
        tasks: ['buildIndex']
      },
      jsbeautifier: {
        files: ['js/*.js'],
        tasks: ['jsbeautifier:default']
      },
      jshint: {
        files: ['js/*.js'],
        tasks: ['jshint']
      },
      sass: {
        files: ['css/source/theme.scss'],
        tasks: ['sass']
      }
    },

    sass: {
      theme: {
        files: {
          'css/theme.css': 'css/source/theme.scss'
        }
      }
    },

    connect: {
      livereload: {
        options: {
          port: 9000,
          hostname: 'localhost',
          base: '.',
          open: true,
          livereload: true
        }
      }
    },

    /**
     * JSHint
     * https://npmjs.org/package/grunt-jsbeautifier
     * 
     */
    jsbeautifier: {
      "default": {
        src: ['js/*.js'],
        options: {
          js: {
            indentSize: 2
          }
        }
      },
      "git-pre-commit": {
        src: ['js/*.js'],
        options : {
            mode:"VERIFY_ONLY",
            js: {
              indentSize: 2
            }
        }
      }
    },

    jshint: {
      options: {
        "curly": true,
        "eqnull": true,
        "eqeqeq": true,
        "undef": true,
        "unused": true,
        "latedef": true,
        "camelcase": true,
        "strict": false,
        "newcap": true,
        "maxcomplexity": 6,
        "globals": {
          "jQuery": true,
          "define": false,
          "setTimeout": false,
          "clearTimeout": false,
          "window": false
        }
      },
      all: ['js/*.js']
    },

    copy: {
      dist: {
        files: [
          {
            expand: true,
            src: ['slides/**', 'bower_components/**', 'js/**', 'css/*.css'],
            dest: 'dist/'
          }, {
            expand: true,
            src: ['index.html'],
            dest: 'dist/',
            filter: 'isFile'
          }
        ]
      }
    }
  });

  require('load-grunt-tasks')(grunt);

  grunt.registerTask('buildIndex', 'Build index.html from templates/_index.html and slides/list.json.', function() {
    
    var html, indexTemplate, sectionTemplate, slides;

    indexTemplate = grunt.file.read('templates/_index.html');
    sectionTemplate = grunt.file.read('templates/_section.html');
    slides = grunt.file.readJSON('slides/list.json');
    html = grunt.template.process(indexTemplate, {
      data: {
        slides: slides,
        section: function(slide) {
          return grunt.template.process(sectionTemplate, {
            data: {
              slide: slide
            }
          });
        }
      }
    });

    return grunt.file.write('index.html', html);

  });

  grunt.registerTask('test', '*Lint* javascript.', ['jshint', 'jsbeautifier:git-pre-commit']);
  grunt.registerTask('server', 'Run presentation locally and start watch process (living document).', ['buildIndex', 'sass', 'connect:livereload', 'watch']);
  grunt.registerTask('dist', 'Save presentation files to *dist* directory.', ['test', 'sass', 'buildIndex', 'copy']);
  grunt.registerTask('default', ['test', 'server']);
};

