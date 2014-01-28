define(function (require) {
  var _ = require("underscore");
  var $ = require('M4jquery');
  var logger = require("M4/logger");
  var Backbone = require("backbone");
  //var ToolgroupCollection = require("M4/collections/toolgroups");
  //var ToolModel = require("M4/models/toolgroup");
  //var ControllerModel = require("M4/models/controller");
  //var WatchlistModel = require("M4/models/scene_watchlist");
  var Labels = require("M4/labels");
  var ConfigLoader = require("bootstrap/config-loader");
  var eventManager = require("M4/events");

  var SceneModel = Backbone.Model.extend({
    
    initialize: function () {
      var self = this;

      self.eventManager = eventManager;
      self.colorCounter = self.get('focus').items.length+1;
      self.maxFocus = 20;

      self.eventManager.listen("s:grid:afterFocusActive", function(focus){
        self.addFocus(focus);
        self.eventManager.emit("s:scene:afterFocusChange");
      }, this);

      self.eventManager.listen("s:grid:afterFocusInactive", function(id){
        self.removeFocusById(id);
      }, this);


      //broadcast a message to the framework when any attribute changed.
      self.on("change", function () {
        //var scope = self.getScope();
        //self.eventManager.emit("s:fw:save", { data: { level: [scope.instanceId] }, scope: scope}); 
      });
    },

    /**
     *  Adds focus to "focuses" array
     *
     *  @method addFocus
     *  @public
     *  
     *  @param {Object} args  Object literal currently containing the "id" and "name" of the focus
     *
     *  @example 
     *      self.addFocus({id: 'id0001', name: 'Google (GOOG)'});
    */
    addFocus: function(args){

      var self = this;
      var id = args.id;
      var title = args.title;
      var focus = {};
      var focuses = self.get('focus').items;

      function increaseCount() {
        if(self.colorCounter === 7){
          self.colorCounter = 1;
        }else{
          self.colorCounter++;
        }
      }

      if(focuses.length === self.maxFocus){
        self.eventManager.emit("b:fw:promptFocusLimitReached");
      }else{
        focus.id = id;
        focus.title = title;
        if(!focus.options){
          focus.options = {};


          if(focuses[focuses.length-1].options.colorClass === "focusColor-"+(self.colorCounter)){
            increaseCount();
          }
          
          focus.options.colorClass = "focusColor-"+(self.colorCounter);
          increaseCount();
        };

        focuses.push(focus);
      }
    },

    /**
     * Makes a focus active
     *
     * @method makeFocusActive
     * @public
     *
     * @param  {string} urn the identifier for the focus object that needs to be made active
     * @return {Object} a pointer back to the object for chaining purposes
     */
    makeFocusActive: function(urn){
      var self = this;
      var focuses = self.get("focus").items;
      var length = focuses.length
      if(self.get("activeFocus")){
        if(urn !== self.get("activeFocus").id){
          for (var i = length - 1; i >= 0; i--) {
            if(focuses[i].id === urn){
              self.set("activeFocus",focuses[i]);
              self.eventManager.emit("s:scene:afterSuperFocusChange");
            }
          };
        }
      }else{
        for (var i = length - 1; i >= 0; i--) {
            if(focuses[i].id === urn){
              self.set("activeFocus",focuses[i]);
              self.eventManager.emit("s:scene:afterSuperFocusChange");
            }
        };
      }

      return self;

    },

    /**
     * Retrieve the active focus 
     *
     * @method getActiveFocus()
     * @public
     * 
     * @return {Object} the focus object
     */
    getActiveFocus: function(){
      var self = this;
      var active = self.get("activeFocus") || null

      return active;
    },

    /**
     * Reset active items back to the first item in the focus array
     *
     * @method resetActiveItems
     * @public
     * 
     * @return {Object} a pointer back to the object for chaining purposes
     */
    resetActiveItems: function(){
      var self = this;
      var focuses = self.get("focus").items;
      var firstItem = focuses[0];

      focuses.length = 0;
      focuses.push(firstItem);
      self.makeFocusActive(focuses[0].id);

      self.eventManager.emit("s:scene:afterFocusChange");
      self.eventManager.emit("s:scene:afterFocusReset");

      return self;

    },
    /**
     *  Remove focus from "focuses" array
     *
     *  @method removeFocusById
     *  @public
     *  
     *  @param {String} id  Id string of focus
     *
     *  @example 
     *      self.removeFocusById('id0001');
    */
    removeFocusById: function(id){
      var self = this;
      var index = self.getFocusIndexById(id);
      var focuses = self.get('focus').items;
      if(focuses.length > 1){
        if(self.get("activeFocus").id === id){
          focuses.splice(index, 1);
          self.makeFocusActive(focuses[focuses.length-1].id);
        }else{
          focuses.splice(index, 1);        
        }
        self.eventManager.emit("s:scene:afterFocusRemove");
        self.eventManager.emit("s:scene:afterFocusChange", id);
      }else{
        self.eventManager.emit("s:fw:promptRemoveLastFocus");
      }

    },

    /**
     *  Get the focus object by it's id
     *
     *  @method getFocusById
     *  @public
     *  
     *  @param {String} id  Id string of focus
     *  @return {Object} focus object
     *
     *  @example 
     *      self.getFocusById('id0001');
    */
    getFocusById: function(id){
      var self = this;
      var collection = self.get('focus').items;
      return _.find(collection, function (focus) {
        return focus.id === id;
      });
    },

    /**
     *  Get the focus index position by it's id
     *
     *  @method getFocusIndexById
     *  @public
     *  
     *  @param {String} id  Id string of focus
     *  @return {number} index of focus
     *
     *  @example 
     *      self.getFocusIndexById('id0001');
    */
    getFocusIndexById: function(id){
      var self = this;
      var focus = self.getFocusById(id);
      var i = _.indexOf(self.get('focus').items, focus);

      return i;
    }

  });

  return SceneModel;
  
});
