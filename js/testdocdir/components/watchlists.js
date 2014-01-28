define(function(require) {
  var $ = require('M4jquery');
  var _ = require("underscore");
  var Backbone = require("backbone");
  var logger = require("M4/logger");
  var Watchlist = require("M4/models/glb_watchlist");
  var fileMgmt = require('utils/file-mgmt-facade');
  var eventManager = require('M4/events');
  var ajax = require("M4/ajax");
  var Url = require("M4/url-builder");

  var Watchlists = Backbone.Collection.extend({
    model: Watchlist,

    /**
     *  @method initialize initialize the method
     *
     */
    initialize: function() {
      var self = this;
      self.eventManager = eventManager;
      self.eventManager.init({
        extendRender: true,
        evtPrefix: 'ugcDrawer'
      }, self);

      self.url = new Url();
      //self.fileMgmt = fileMgmt.returnAPI(2);
      //self.loadLists();
      this.on('add', function() {
        eventManager.emit('s:fw:afterWatchlistCollectionChanged');
      });
    },

    /*
     *  @method comparator
     *   Sort collection by date created
     *   the '-' symbol negates values to return in reverse order
     */
    comparator: function(wl) {
      return -wl.get('createdDate');
    },

    /**
     * Via Screener API, Gets the Lists from backend
     *  @method loadListData
     *   Get watchlist data
     */
    loadLists: function() {

      var self = this;
      self.listsUrl = "/data-screener/api/v3/lists";

      if (self.activeListItem && self.activeListItem.length > 0) {
        if (self.activeListItem !== 'temp') {
          self.listsUrl += '?activeListId=' + self.activeListItem;
        } else {
          var active = self.getActive();
          active.params.modelChanged = true;
        }
      }

      ajax({
        url: self.listsUrl,
        type: "GET",
        async: false,
        dataType: "JSON",
        success: function(res) {
          // add the lists to the collection
          self.add(res.lists);

          if (res.activeList) {
            var existingListModel = self.where({
              'id': res.activeList.fileMgmtObjId
            })[0];

            existingListModel.set(res.activeList, {
              silent: true
            });

          }
          // event emitter
          var args = {
            data: self.getActive(),
            activeListItem: self.activeListItem
          };
          eventManager.emit("b:listMgmt:dataLoaded", args);
        }
      });

      return self;
    },

    /**
     * Via Screener API, Gets the long form data for a list item
     * from the backend, merges it into collection
     *
     * @return {Watchlist}
     * @method getLongFormListData
     * @param  {String} key
     * @return {Object} list item
     */
    getLongFormListData: function(key) {
      var self = this;
      if (key && key.length > 0) {
        ajax({
          url: "/data-screener/api/v3/lists/" + key,
          type: "GET",
          async: false,
          dataType: "JSON"
        }).done(function(data) {
          // add the long form data to the collection
          self.add(data, {
            merge: true
          });
          self.longFormData = data;
        });
      }
      return self;
    },

    /**
     *  @method getListByKey
     *
     *    Returns a list matched by key
     *
     *  @return {List}
     */
    getListbyKey: function(key) {
      var self = this;
      var list;
      if (key && key.length > 0) {
        list = self.where({
          'id': key
        })[0];
      }
      if (typeof list === 'undefined') {
        list = self.where({
          'fileMgmtObjId': key
        })[0];
      }

      if (typeof list !== 'undefined') {
       return list;
      } else {
        return null;
      }

    },


    /**
     *  @method getActive
     *    Returns the active watchlist.
     *
     *  @return {List} The current active list
     */
    getActive: function() {
      var self = this;
      var list;
      if (self.activeListItem && self.activeListItem.length > 0) {
        list = self.where({
          'id': self.activeListItem
        });
        if (list && list.length > 0) {
          return list[0];
        } else {
          return null;
        }
      }
    },

    loadActiveResults: function(callback) {
      var self = this;
      var pgcriteria;
      var id = self.activeListItem;
      var active = self.getActive();

      if (typeof active !== 'undefined') {
        pgcriteria = {
          objectTypeId: active.attributes.objectTypeId,
          pgcriteria: active.attributes.data.list.pgcriteria,
          filter: active.attributes.data.list.filter
        };
        ajax({
          url: "/data-screener/api/searchcriteria",
          type: "POST",
          data: JSON.stringify(pgcriteria),
          async: false,
          dataType: "JSON",
          success: function(res) {
            var data = active.get('data');
            data.result.rows = res.rows;
            data.result.counts = res.counts;
            data.result.passedexclude = res.passedexclude;
            data.result.passedinclude = res.passedinclude;
            data.result.pos = res.pos;

            //active.get('data').result.
            if ($.isFunction(callback)) {
              callback();
            }
            self.eventManager.emit("b:activeList:resultsLoaded", {});
          }
        });
      }

      return self;
    },

    /**
     * Sets the columnsetId attr on the list and saves the list
     *
     * @method  setListActiveColumnsetId
     * @param {String} key         List key
     * @param {String} columnsetId Columnset Key
     */
    setListActiveColumnsetId: function(key, columnsetId) {
      var self = this;
      var list = self.getListbyKey(key);
      if (typeof list !== 'undefined') {
        var listdata = list.get('data');
        if (typeof listdata !== 'undefined') {
          list.get('data').set('lastUsedColumnsetId', columnsetId);
          list.saveList(self.activeListItem);
        }
      }
    },

    /**
     * Returns the columnsetId for the active list
     * @method getListActiveColumnsetId
     * @param  {String} key   list key
     * @return {String} id    columnsetId
     */
    getListActiveColumnsetId: function(key) {
      var self = this;
      var colsetid;
      logger.info('getListActiveColumnsetId: ' + key);
      var list = self.getListbyKey(key);
      if (list !== 'undefined' && typeof list.get('data') !== 'undefined') {
        var listdata = list.get('data');
        if (listdata.lastUsedColumnSetId && listdata.lastUsedColumnSetId !== null) {
          colsetid = listdata.lastUsedColumnSetId;
        } else {
          if (list.get('objectTypeId') === 2007) {
            listdata.defaultColumnSetId = 8;
          } else if (list.get('objectTypeId') === 2045) {
            listdata.defaultColumnSetId = 1;
          }
          colsetid = listdata.defaultColumnSetId;
        }
        return colsetid;
      }
    },

    /**
     * [getNewListName description]
     * @param  {[type]} list [description]
     * @return {[type]}       [description]
     */
    getNewListName: function(origName) {

      var now = new Date();
      return origName + ' (' + now.format("mm-dd-yy h:MM:ss") +')';

    },
    /**
     *  Saves the active List
     *  @method saveList
     *  @param {String} key - String representing the list key
     */
    saveList: function(key, callback) {
      var self = this;
      logger.info('Saving the list: ' + key);

      // var list = self.getActive();
      var list = self.where({
        'id': key
      });
      list = list[0];
      if (typeof list !== 'undefined') {
        var listId = list.get('id');
        if (listId === 'temp' || listId === 'demo-list') { // demo list in place for api demo tool
          // not yet saved, so save it
          self.addList(list, callback);
        } else {
          // previously saved, so we'll update
          var listRows = list.get('data').result.rows;
          list.get('data').result.rows = null;
          self.updateList(key, list.attributes, function() {
            list.get('data').result.rows = listRows;
            if(_.isFunction(callback)){
              callback();
            }
          });
          return true;
        }
      }
      return list;
    },
    /**
     * via Screener API, Removes specified list from watchlist
     * @method remove
     * @param {string} key Id of the list to be removed
     * @param {function} callback Function called after the list is removed
     *
     */
    removeList: function(key, callback) {
      var self = this;
      logger.info('Removing the list: ' + key);
      var list = this.getListbyKey(key);
      ajax({
        url: "/data-screener/api/v3/lists/" + key,
        type: "DELETE",
        async: false,
        dataType: "JSON",
        success: function() {
          logger.info('list removed: ' + key);
          self.remove(list);
          if ($.isFunction(callback)) {
            callback();
          }
        },
        error: function(err) {
          logger.info('delete failed', err);
        }
      });
    },

    /**
     * via Screener API, Updates a list
     * @param  {String}   key
     * @param  {Function} callback
     */
    updateList: function(key, updates, callback) {
      var self = this;
      var list = self.where({
        'id': key
      })[0];
      var listId = list.get('id');

      if (typeof list !== 'undefined') {
        $.extend(true, list, updates);
        ajax({
          url: "/data-screener/api/v3/lists/" + key,
          type: "PUT",
          data: JSON.stringify(list),
          async: false,
          dataType: "JSON",
          success: function() {
            list.params.modelChanged = false;
            if ($.isFunction(callback)) {
              callback();
            }
          }
        });
      }
      return list;
    },
    /**
     * via Screener API, Renames a list
     * @param  {String}   key
     * @param  {Function} callback
     */
    renameList: function(key, name, callback) {
      var self = this;
      logger.info('renaming list with key: ' + key + ' to ' + name);
      ajax({
        url: "/data-screener/api/v3/lists/" + key + "/name",
        type: "PUT",
        data: '"' + name + '"',
        async: false,
        dataType: "JSON",
        success: function() {
          if ($.isFunction(callback)) {
            callback();
          }
        }
      });
      return self;

    },
    /**
     * Via Screener API, Adds a new list
     * @method  addList
     * @param {String}   name
     * @param {Object}   customData
     * @param {Function} callback
     */
    addList: function(list, callback) {
      var self = this;

      if (list.get('name') === 'UNTITLED LIST') {
        var name = self.getNewListName(list.get('name'));
        list.set('name', name);
      }

      if (typeof list !== 'undefined') {
        ajax({
          url: "/data-screener/api/v3/lists",
          type: "POST",
          data: JSON.stringify(_.omit(list, ['key', 'id'])),
          async: false,
          dataType: "JSON",
          success: function(res, status, xhr) {
            var location = xhr.getResponseHeader('Location');
            var parts = location.split('/');

            var id = parts[parts.length - 1];

            list.set('id', id);
            list.set('fileMgmtObjId', id);
            list.set('key', id);
            self.activeListItem = id;
            list.params.modelChanged = false;

            if ($.isFunction(callback)) {
              callback();
            }
          }
        });

      } else {

      }
    },

    baseListObject: function() {

      var list = {
        "name": null,
        "key": null,
        "objectTypeId": null,
        "data": {
          "lastUsedColumnSetId": null,
          "defaultColumnSetId": "1",
          "list": {
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
      return list;
    },

    incrementDuplicateCounter: function(key) {
      var self = this;
      var srcList;
      srcList = self.where({
        id: key
      })[0];
      if (srcList.get('data') && typeof srcList.get('data').duplicateCount !== 'undefined') {
        // data attrib exists
        srcList.get('data').duplicateCount++;

      } else {

        srcList.get('data').duplicateCount = 1;
      }

      srcList.collection.updateList(srcList.get('id'), {
        data: {
          duplicateCount: srcList.get('data').duplicateCount
        }
      }, {});
      return srcList.get('data').duplicateCount;
    },

    /**
     *  Duplicates a List
     *  @method duplicateList
     *  @param {String} key - String representing the list key
     */
    duplicateList: function(key, callback) {
      var self = this;
      var list = self.getListbyKey(key);
      var name = self.getNewListName(list.get('name'));
      ajax({
        url: "/data-screener/api/v3/lists?sourceListId=" + key + '&newListName=' + name,
        type: "GET",
        async: false,
        dataType: "JSON",
        success: function(res, status, xhr) {
          logger.info('add res', res);
          self.add(res);
          if ($.isFunction(callback)) {
            logger.info('dupe callback', res);
            callback();
          }
        }
      });
    }
  });

  return Watchlists;
});
