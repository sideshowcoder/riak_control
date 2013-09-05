minispade.register('stats', function() {
  var id = 0;

  /**
   * @class
   *
   * Time Series mixin.
   */
  RiakControl.TimeSeries = Ember.Object.extend(
    /** @scope RiakControl.TimeSeries.prototype */ {

    markerID: 0,
    areaSelector: '#graphs',
    duration: 925,
    toolName: '',
    statName: '',
    average: 0,
    statGraphCreator: null,

    title: function () {
      return this.get('toolName').toUpperCase().replace(/^RIAK\_/, '') +
             ' - ' +
             this.get('statName').replace(/[\_\-]+/g, ' ');
    }.property('toolName', 'statName'),

    /**
     * X-axis range.
     */
    xMin: 1,
    xMax: 100,
    dynamicXMin: null,
    dynamicXMax: null,

    /**
     * Time series margins.
     */
    marginTop: 20,
    marginRight: 20,
    marginBottom: 20,
    marginLeft: 40,

    /**
     * Time series dimensions.
     */
    width: function () {
      return 960 - this.get('marginLeft') - this.get('marginRight');
    }.property('marginLeft', 'marginRight'),

    height: function () {
      return 200 - this.get('marginTop') - this.get('marginBottom');
    }.property('marginTop', 'marginBottom'),

    /**
     * Axes
     */
    xAxis: function () {
      return d3.scale.linear()
                     .domain([this.get('xMin'), this.get('xMax') - 2])
                     .range([0, this.get('width')]);
    }.property('xMin', 'xMax'),

    yAxis: function () {
      return d3.scale.linear()
                     .domain([0, 500])
                     .range([this.get('height'), 0]);
    }.property('height'),

    /**
     * For drawing a line on the graph.
     */
    line: function () {
      var that = this;
      return d3.svg.line()
                   .interpolate('basis')
                   .x(function(d, i) { return that.get('xAxis')(i); })
                   .y(function(d, i) { return that.get('yAxis')(d); });
    }.property('xAxis', 'yAxis'),

    /**
     * Initial data. Draws a flat line across the graph
     * at the midway point for this particular stat.
     */
    data: function () {
      var average = this.get('average');
      return d3.range(this.get('xMax')).map(function () {
        return average;
      });
    }.property('xMax', 'average'),

    /**
     * Header controls.
     */
    heading: function () {
      var areaSelector = this.get('areaSelector'),
          id = this.get('markerID');

      $(areaSelector).append(
        '<h2 class="marker' + id + '">' + this.get('title') + '</h2>');
      return $(areaSelector).append(
        '<a class="remove-graph marker' + id + '">remove this graph</a>');
    }.property('areaSelector', 'markerID', 'title'),

    /**
     * The svg element
     */
    svg: function () {
      var id = this.get('markerID'),
          width = this.get('width'),
          height = this.get('height'),
          marginLeft = this.get('marginLeft'),
          marginTop = this.get('marginTop'),
          yAxis = this.get('yAxis'),
          svg;

      svg = d3.select(this.get('areaSelector'))
              .append("svg")
                .attr("class", "marker" + id)
                .attr("width",
                      width + marginLeft + this.get('marginRight'))
                .attr("height",
                     height + marginTop + this.get('marginBottom'))
              .append("g")
                .attr("transform", 
                      "translate(" + marginLeft + "," + marginTop + ")");

      svg .append("defs")
          .append("clipPath")
            .attr("id", "clip" + id)
          .append("rect")
            .attr("width", width)
            .attr("height", height);

      svg .append("g")
            .attr("class", "x axis xaxis" + id)
            .attr("transform", "translate(0," + yAxis(0) + ")")
            .call(d3.svg.axis().scale(this.get('xAxis')).orient("bottom"));
          
      svg .append("g")
            .attr("class", "y axis yaxis" + id)
            .call(d3.svg.axis().scale(yAxis).ticks(5).orient("left"));

      return svg;
    
    }.property('areaSelector', 'markerID',
               'width', 'height',
               'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
               'xAxis', 'yAxis'),

    /**
     * The path element.
     */
    path: function () {
      return this.get('svg')
        .append("g")
          .attr("clip-path", "url(#clip" + this.get('markerID') + ")")
        .append("path")
          .datum(this.get('data'))
          .attr("class", "line")
          .attr("d", this.get('line'));
    }.property('svg', 'markerID', 'data', 'line'),

    /**
     * Function for animating the graph
     */
    tick: function (newData) {
      var newx,
          newXMin = (this.get('dynamicXMin') || this.get('xMin')) + 1,
          newXMax = (this.get('dynamicXMax') || this.get('xMax')) + 1,
          id = this.get('markerID'),
          data = this.get('data'),
          duration = this.get('duration'),
          that = this,
          stillExists = $('.marker' + id).length;

      /*
       * If the graph hasn't been removed, redraw stuff.
       */
      if (stillExists) {

        /*
         * Push a new data point onto the back.
         */
        data.push(newData);

        /*
         * Redraw the line, and slide it to the left
         */
        this.get('path')
              .attr("d", this.get('line'))
              .attr("transform", null)
            .transition()
              .duration(duration)
              .ease("linear")
              .attr("transform", "translate(" + this.get('xAxis')(0) + ",0)");

        newx = d3.scale.linear()
                       .domain([newXMin, newXMax - 2])
                       .range([0, this.get('width')]);
        
        d3.select(".xaxis" + id)
          .transition()
          .duration(duration)
          .ease('linear')
          .call(d3.svg.axis().scale(newx).orient('bottom'));

        this.setProperties({'dynamicXMin': newXMin, 'dynamicXMax': newXMax});

        /*
         * Remove the no-longer-visible data point.
         */
        data.shift();
      }
    },

    /**
     * Describes how to remove this graph from the DOM, also
     * how to destroy this object and clean up the parent array
     * that contains it.
     *
     * @returns {void}
     */
    setupRemove: function () {
      var id = this.get('markerID'),
          creator = this.get('statGraphCreator'),
          thisObj = this;

      /*
       * When we click the associated 'remove graph' button,
       * delete this jQuery event because it will no longer be
       * relevant, remove all DOM elements associated with this
       * object's id, and finally mark the chart for destruction.
       */
      $('.remove-graph.marker' + id).on('click', function (ev) {
        $('.remove-graph.marker' + id).off('click');
        $('.marker' + id).slideUp(function () {
          $(this).remove();
        });
        creator.get('destroyObj').call(creator, thisObj);
      });
    },

    /**
     * Draw the heading information and then draw
     * the actual chart. Create a jQuery event for
     * removing the chart as well.
     *
     * @retuns {void}
     */
    start: function () {
      this.get('heading');
      this.get('tick').call(this, this.get('average'));
      this.get('setupRemove').call(this);
    }
  });

  /**
   * @class
   *
   * Content for the add graph dropdown menu.
   */
  RiakControl.AddGraphSelectView = Ember.Select.extend({
    content: [
      '-- Choose a Statistic --',
      'KV - cpu_avg1',
      'KV - cpu_avg5',
      'KV - cpu_avg15',
      'KV - cpu_nprocs',
      'KV - node_get_fsm_active',
      'KV - node_get_fsm_active_60s',
      'KV - node_get_fsm_in_rate',
      'KV - node_get_fsm_objsize_95',
      'KV - node_get_fsm_objsize_99',
      'KV - node_get_fsm_objsize_100',
      'KV - node_get_fsm_objsize_mean',
      'KV - node_get_fsm_objsize_median',
      'KV - node_get_fsm_out_rate',
      'KV - node_get_fsm_rejected',
      'KV - node_get_fsm_rejected_60s',
      'KV - node_get_fsm_rejected_total',
      'KV - node_get_fsm_siblings_95',
      'KV - node_get_fsm_siblings_99',
      'KV - node_get_fsm_siblings_100',
      'KV - node_get_fsm_siblings_mean',
      'KV - node_get_fsm_siblings_median',
      'KV - node_get_fsm_time_95',
      'KV - node_get_fsm_time_99',
      'KV - node_get_fsm_time_100',
      'KV - node_get_fsm_time_mean',
      'KV - node_get_fsm_time_median',
      'KV - node_gets',
      'KV - node_gets_total',
      'KV - node_put_fsm_active',
      'KV - node_put_fsm_active_60s',
      'KV - node_put_fsm_in_rate',
      'KV - node_put_fsm_out_rate',
      'KV - node_put_fsm_rejected',
      'KV - node_put_fsm_rejected_60s',
      'KV - node_put_fsm_rejected_total',
      'KV - node_put_fsm_time_95',
      'KV - node_put_fsm_time_99',
      'KV - node_put_fsm_time_100',
      'KV - node_put_fsm_time_mean',
      'KV - node_put_fsm_time_median',
      'KV - node_puts',
      'KV - node_puts_total'
    ]
  });

  /**
   * @class
   */
  RiakControl.StatsView = Ember.View.extend(
    /** @scope RiakControl.StatsView.prototype */ {
    templateName: 'stats'
  });

  /**
   * @class
   *
   * StatsController is responsible for displaying graphs related
   * to cluster statistics.
   */
  RiakControl.StatsController = Ember.ArrayController.extend(
    /**
     * Shares properties with RiakControl.ClusterController
     */
    RiakControl.ClusterAndNodeControls,
    /** @scope RiakControl.NodesController.prototype */ {

    /**
     * Gathers the current set of stats and hands them over
     * to the StatGraphCreator.
     *
     * @returns {void}
     */
    gatherNewStats: function () {
      var stats = [];
      this.get('content').map(function (item) {
        stats.push({name: item.get('name'), stats: item.get('stats')});
      });
      RiakControl.StatGraphCreator.set('stats', stats);
    },

    /**
     * Reloads the record array associated with this controller.
     *
     * @returns {void}
     */
    reload: function() {
      this.gatherNewStats();
      this.get('content').reload();
    }
  });

  /**
   * A place for storing graphs and their associated objects.
   */
  RiakControl.StatGraphCreator = Ember.ArrayController.create({
    content: [],

    /**
     * Tracks available stats for every node.
     */
    stats: [],

    /**
     * Whenever we get a new set of stats, we go through and
     * update the numbers for each graph.
     */
    updateGraphs: function () {
      var graphs = this.get('content'),
          stats  = this.get('stats');
      
      graphs.map(function (item) {
        var tool   = item.get('toolName'),
            stat   = item.get('statName'),
            newVal;

        item.tick(stats[0].stats[tool][stat]);
      });
    }.observes('stats'), 

    /**
     * Tracks the selected option in RiakControl.AddGraphSelectView.
     */
    selectedStat: '',

    /**
     * Function for creating a new graph.
     */
    createGraph: function () {

      /*
       * Get the stat name and clean stuff like "KV - " off the front of it.
       */
      var selected = this.get('selectedStat'),
          toolName = 'riak_' + selected.slice(0, selected.indexOf(' '))
                                       .toLowerCase(),
          statName = selected.replace(/^[^\s]+\s+\-\s+/, ''),
          graphObject;

      /*
       * If the selected item is not the default option...
       */
      if (selected !== '-- Choose a Statistic --') {

        /*
         * Create a new graph.
         * Every new graph needs a markerID, a title,
         * an average point, and `this` as its creator.
         */
        graphObject = RiakControl.TimeSeries.create({
          markerID: id += 1,
          toolName: toolName,
          statName: statName,
          average: 0,
          statGraphCreator: this
        });

        /*
         * Store the object in our array and
         * light it up.
         */
        this.pushObject(graphObject);
        graphObject.start();

        /*
         * Set the dropdown back to the default option.
         */
        $('#add-new-graph select').find('option:first')
                                  .attr('selected', 'selected');
      }
    }.observes('selectedStat'),

    /**
     * Whenever the user clicks the remove graph button, the TimeSeries
     * object will run this method and pass itself in effectively destroying
     * itself and cleaning up the content array.
     */
    destroyObj: function (obj) {
      this.removeObject(this.findProperty('markerID', obj.get('markerID')));
      obj.destroy();
    }

  });

});