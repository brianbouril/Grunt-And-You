define(function(require) {
  var _ = require("underscore");
  var $ = require('M4jquery');
  var Backbone = require('backbone');
  var eventManager = require('M4/events');
  var Ajax = require('M4/ajax');
  var logger = require('M4/logger');
  var labels = require('M4/labels');
  var M4Util = require('M4/m4util');
  var Error = require("M4/error");
  var ToolCollection = require("M4/collections/tools");
  var WatchlistCollection = require("M4/collections/watchlists");
  var ColumnsetCollection = require("M4/collections/columnsets");
  var Watchlist = require('M4/models/glb_watchlist');
  var Columnset = require('M4/models/columnset');
  var ControllerModel = require("M4/models/controller");
  var SceneModel = require("M4/models/scene");
  var fileMgmt = require('utils/file-mgmt-facade');
  var Url = require("M4/url-builder");
  var ConfigLoader = require("bootstrap/config-loader");
  // var userPrefs = require('M4/user-prefs');
  var GlobalSettingsModel = require('M4/models/global-setting/globalsettings');
  require('css!M4find/css/find');
  require('css!style/framework/layout');
  require('css!style/themes/dark/base');

  var ProductModel = Backbone.Model.extend({
    eventManager: null,
    initialize: function(id) {
      var self = this;

      self.eventManager = eventManager;
      self.id = id;
      self.sceneStateChanged = false;
      self.url = new Url();
      // LEGACY - various code still refers to ConfigLoader.prodId, so set that now.
      ConfigLoader.prodId = id;

      // Load user preferences (global settings) and store them on this.
      // self.userPrefs = userPrefs;
      self.userPrefs = new GlobalSettingsModel({}, {
        product: this
      });
      self.userPrefs.load();

      self.eventManager.listen("b:fw:setSceneStateSaveFlag", function(save) {
        logger.info('change in collection');
        self.sceneStateChanged = save;
      }, this);

      self.eventManager.listen("b:fw:addSingleTool", self.createToolModel, this);

      self.eventManager.listen("s:scene:saveState", function(async) {
        self.save(async);
      }, this);

    },

    /**
     *  Saves scene state
     *
     *  @method save
     *  @public
     *
     *  @param {Boolean} async  Boolean that gets passed to determine if async should be set to true or false, by default it is set to true.
     *
     *    TODO: on calling this method should we check that the url has all required parameters?
     *        Required parameters in URL are (wsid, st, context or contextid)
     *  @example
     *      self.save();
     */
    save: function(async) {
      var self = this;
      var async = async || true;
      var newId = ConfigLoader.generateGUID();
      var timestamp = new Date();
      var stateJSON = {};
      var sceneModel = self.get('sceneModel');
      // Get object type from the list in R3 once we support saving grid and screener in history
      //var objectTypeId = self.get('watchlistCollection').getActive().get('objectTypeId');
      var objectTypeId = sceneModel.get('objectType');

      // If the scene doesn't have an object type we do not want to save
      if (objectTypeId !== null && objectTypeId !== undefined) {

        stateJSON.id = newId; // Guid
        stateJSON.tools = self.get('toolCollection').toJSON();
        stateJSON.title = sceneModel.get('title');
        stateJSON.focus = sceneModel.get('focus');
        stateJSON.st_id = sceneModel.get('st_id');
        stateJSON.controller = self.get('controllerModel').toJSON(); // Controller
        stateJSON.objectType = objectTypeId; // Store the object type in arrray
        stateJSON.context = sceneModel.get('context');
        stateJSON.listName = sceneModel.get('listName');
        stateJSON.contextId = sceneModel.get('contextId');
        stateJSON.listType = sceneModel.get('listType');
        stateJSON.activeFocus = sceneModel.get('activeFocus');
        stateJSON.timestamp = timestamp; // Timestamp

        Ajax({
          url: '/core/data/wsid/undefined/scene/' + newId,
          type: "post",
          async: async,
          data: JSON.stringify(stateJSON),
          success: function(data) {
            //...do something here
          }
        });

      } //end if

    },

    getFocusItems: function() {
      var self = this;

      return self.get('sceneModel').get('focus').items;
    },

    // Returns an array of comparators combined from all tools with duplicates removed
    getToolComparators: function() {
      var self = this;
      var toolCollection = self.get("toolCollection");
      var comparatorArray = [];

      // add all the objects together
      toolCollection.each(function(model, i) {
        var comparators = model.get('state').comparators;
        // Check if the tool model has comparators
        if (comparators !== undefined) {
          // Add them all to a single array
          for (var i = comparators.length - 1; i >= 0; i--) {
            comparatorArray.push(comparators[i]);
          };
        }
      });

      // Return the array and remove any duplicate objects accross the tools
      return self.removeDuplicateObjects(comparatorArray, 'id');
    },

    removeToolComparator: function(id) {
      var self = this;
      var toolCollection = this.get("toolCollection");

      // add all the objects together
      toolCollection.each(function(model, i) {
        var comparators = model.get('state').comparators || [];
        for (var i = 0, n = comparators.length; i < n; i++) {
          if (comparators[i].id === id) {
            comparators.splice(i, 1);
            break;
          }
        }
      });

      eventManager.emit("s:tool:saveDataSuccess");
    },

    removeTool: function(id) {
      var self = this;
      var toolCollection = this.get("toolCollection");
      toolCollection.each(function(model, i) {
        if (model.get('tt_id') === id) {
          toolCollection.remove(model);
          self.eventManager.emit("b:fw:setSceneStateSaveFlag", true);
          return false;
        }
      });
    },

    // Method takes an array and comparer string then removes any objects in the array that have duplicates
    removeDuplicateObjects: function(array, comparer) {
      var arr = {};

      for (var i = array.length - 1; i >= 0; i--) {
        arr[array[i][comparer]] = array[i];
      }

      array = new Array();

      for (var key in arr) {
        array.push(arr[key]);
      }

      return array;
    },

    createWatchlistModels: function() {
      var self = this;
      var objectTypeId;
      self.set('watchlistModel', new Watchlist({}, {
        product: this
      }));
      self.contextid = self.url.getParameterValue('contextid');

      var listData = {
        "name": null,
        "key": null,
        "objectTypeId": null,
        "data": {
          "lastUsedColumnSetId": null,
          "defaultColumnSetId": "1",
          "list": {
            "objectTypeId": null,
            "pgcriteria": {
              "criteria": [],
              "exclude": [],
              "include": []
            },
            "filter": {
              "criteria": [],
              "exclude": [],
              "include": []
            }
          },
          "widgets": [],
          "result": {
            "rows": []
          }
        }
      };

      var cxt = window.M4_CONFIG.context.source;

      switch (cxt) {
        case 'ContextId':
          listData.id = self.contextid;
          listData.name = ''; //window.M4_CONFIG.context.listName;
          break;
        case 'SceneData':
          listData.id = 'temp';
          listData.name = 'SCENE DATA LIST';
          break;
        case 'Broken':
          listData.name = 'Broken List';
          break;
        default:
          listData.id = 'temp';
          listData.name = 'UNTITLED LIST';
          break;
      }
      if (self.get("sceneModel").get("objectType")) {
        objectTypeId = self.get("sceneModel").get("objectType")[0];
        listData.objectTypeId = objectTypeId;
        listData.data.list.objectTypeId = objectTypeId;
        if (objectTypeId === 2007) {
          listData.data.defaultColumnSetId = "8";
        } else if (objectTypeId === 2045) {
          listData.data.defaultColumnSetId = "1";
        } else {
          listData.data.defaultColumnSetId = "8";
        }
      }

      /**
       * get the items from the context list
       */
      if (window.M4_CONFIG.context.items && window.M4_CONFIG.context.items.length > 0) {

        // THE CONTROLLER SHOULD HANDLE THIS??
        $.each(window.M4_CONFIG.context.items, function(key, value) {
          var obj = {
            id: value.id,
            userData: null,
            data: [
              value.title
            ]
          };
          listData.data.result.rows.push(obj);
          listData.data.list.pgcriteria.include.push(value.id);
        });
      }
      var listCollection = new WatchlistCollection([listData]);
      listCollection.activeListItem = listData.id;
      listCollection.loadLists();

      self.set('watchlistCollection', listCollection);
      return self;
    },

    createColumnsetsModels: function() {
      this.set('columnsetModel', new Columnset({}, {
        product: this
      }));

      // User Columnsets
      var ucc = new ColumnsetCollection({}, {
        product: this
      });
      ucc.setCollectionType('user');
      ucc.reset();
      ucc.getColumnsetsData();

      this.set('userColumnsetCollection', ucc);

      // Morningstar Columnsets
      var mcc = new ColumnsetCollection({}, {
        product: this
      });
      mcc.setCollectionType('mstar');
      mcc.reset();
      mcc.getColumnsetsData();

      this.set('mstarColumnsetCollection', mcc);
    },

    createToolModels: function() {
      this.set("toolCollection", new ToolCollection(window.M4_CONFIG.scene.tools, {
        product: this
      }));

      return this;
    },

    createToolModel: function(config) {
      this.get("toolCollection").add(config);
      this.eventManager.emit("b:fw:setSceneStateSaveFlag", true);

      return this;
    },

    createControllerModel: function() {
      this.set("controllerModel", new ControllerModel(window.M4_CONFIG.scene.controller, {
        product: this
      }));

      return this;
    },
    createSceneModel: function() {
      this.set("sceneModel", new SceneModel(window.M4_CONFIG.scene, {
        product: this
      }));

      return this;
    },
    reOrderTools: function(newOrder) {
      var coll = this.get('toolCollection');
      coll.reOrder(newOrder, "index");
    }

  });

  return ProductModel;

});
