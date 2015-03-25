var southWest = L.latLng(33.5, -85),
  northEast = L.latLng(37, -75),
  bounds = L.latLngBounds(southWest, northEast);

var map = L.map("map", {
  // center: [35.7806, -78.6389],
  minZoom: 7,
  maxBounds: bounds
});

map.fitBounds(bounds);

L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
}).addTo(map);

//var museum = L.marker([35.7822,-78.6394]).addTo(map);

//Create svg layer and append to leaflet pane
var svg = d3.select(map.getPanes().overlayPane).append("svg"),
  g = svg.append("g").attr("class", "leaflet-zoom-hide");

//Load geojson data and process and add to map
d3.json("js/TorNCwgs84estTZ.geojson", function(tornadoes) {
  //This function projects the tornado path data into Leaflet Lat/Lon
  function projectPoint(x, y) {
    var point = map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
  }

  //Transform data from GeoJSON to SVG with d3.geo.path
  var transform = d3.geo.transform({point: projectPoint}),
    tornadoPaths = d3.geo.path().projection(transform);

  //Color tornado paths based on season
  function seasonColor(season) {
    if (season === "Spring") {
      return "#00c99a";
    } else if (season === "Summer") {
      return "#fbd528";
    } else if (season === "Fall") {
      return "#ff5500";
    } else if (season === "Winter") {
      return "#425e89";
    }
  }

  //Create tornado geo paths and create empty variables for compass and graph
  // svg data
  var tornadoGeo = g.selectAll("path")
    .data(tornadoes.features)
    .enter().append("path")
    .attr({
      "class": function(d) { return "toggle tornado-path " + d.properties.SEASON; },
      "stroke": function(d) { return seasonColor(d.properties.SEASON); },
      "opacity": 1
    }),
    tornadoComp,
    tornadoGraph,
    sliderDate;

  updateView();
  map.on("viewreset", updateView);

  //Redraw d3 map items on zoom and pan
  function updateView() {
    var bounds = tornadoPaths.bounds(tornadoes),
      topLeft = bounds[0],
      bottomRight = bounds[1];

    svg.attr({
      "width": bottomRight[0] - topLeft[0],
      "height": bottomRight[1] - topLeft[1]
    })
    .style({
      "left": topLeft[0] + "px",
      "top": topLeft[1] + "px"
    });

    g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");
    tornadoGeo.attr("d", tornadoPaths);

    tornadoGeo.attr({
      "stroke-dasharray": function(d) {
        return this.getTotalLength() + " " + this.getTotalLength();
      },
      "stroke-dashoffset": function(d) {
        return d3.select(this).classed("dateOff") ||
          d3.select(this).classed("seasonOff") ? this.getTotalLength() : 0;
      }
    });
  }

  //Create key, graph, compass svg and get size metrics
  var key = d3.select("#mapKey");
  var graph = d3.select("#graph").append("svg")
      .attr({
        "class": "graph-svg",
        // "shape-rendering": "crispEdges"
      }),
    graphWidth = parseInt(graph.style("width").split("p")[0]),
    graphHeight = parseInt(graph.style("height").split("p")[0]),
    graphPaddingVert = 25,
    graphPaddingHor = 15,
    maxLength; //Holder for count of tornadoes occurring on most active day

  var timeFormat = d3.time.format("%j"),
    tornadoDay = d3.nest()
      .key(function(d) { return parseInt(timeFormat(new Date(d.DATE))); })
      .map(tornadoes.features.map(function(d) { return d.properties; }) );


  var compass = d3.select("#pathCompass").append("svg").attr("class", "compass-svg"),
    compassWidth = parseInt(compass.style("width").split("p")[0]),
    compassHeight = parseInt(compass.style("height").split("p")[0]),
    minorLength = compassWidth > compassHeight ? compassHeight - 10 : compassWidth - 10,
    rectHeight = 2;

  //Filter data to select only tornadoes with start/stop lat/lon coordinates
  //for tornado degree direction
  var directionData = tornadoes.features.filter(function(d) {
    return d.properties.ELAT !== "0.0";
  });

  createKey();
  createGraph();
  createCompass();
  makeSlider();

  function createKey() {
    var seasons = ["Spring", "Summer", "Fall", "Winter"],
      xPadding = 10, yPadding = 10,
      boxSide = 50;

    var keyItem = d3.select("#mapKey")
      .selectAll("key-svg")
        .data(seasons)
        .enter().append("svg")
          .attr("class", "key-svg");

    //Add buttons to toggle data on/off
    keyItem.append("rect")
      .attr({
        "class": function(d) { return "check-box " + d; },
        "x": xPadding,
        "y": yPadding,
        "rx": 5,
        "ry": 5,
        "fill": function(d) { return seasonColor(d); },
        "width": boxSide,
        "height": boxSide
      });

    //Add map symbol
    keyItem.append("rect")
      .attr({
        "x": xPadding * 2 + boxSide,
        "y": yPadding + boxSide / 2 - 2,
        "fill": function(d) { return seasonColor(d); },
        "width": 30,
        "height": 4
      });

    //Add season text next to symbols
    keyItem.append("text")
      .attr({
        "class": "svg-text",
        "x": xPadding * 3 + boxSide + 30,
        "y": yPadding + boxSide / 2,
        "alignment-baseline": "central"
      })
      .text(function(d) { return d; });

    //Add interactivity to buttons
    d3.selectAll(".check-box")
    .on("click", function() {
      var box = d3.select(this),
      color = seasonColor(box.datum());

      if (box.attr("fill") === "#fff") {
        box.attr("fill", color);
        d3.selectAll(".tornado-path." + box.datum()).classed("seasonOff", false);
        d3.selectAll(".compass-path." + box.datum()).classed("seasonOff", false);

        d3.selectAll(".graph-path." + box.datum()).classed("seasonOff", false);

      } else {
        box.attr("fill", "#fff");
        d3.selectAll(".tornado-path." + box.datum()).classed("seasonOff", true);
        d3.selectAll(".compass-path." + box.datum()).classed("seasonOff", true);
        d3.selectAll(".graph-path." + box.datum()).classed("seasonOff", true);
      }

      updateVis(sliderDate);
    });
  }

  function createGraph() {
    //Create bar graph of tornadoes by day of year (0-366)
    //Set up axes for graph
    var timeScale = d3.time.scale()
      .domain([new Date(2012, 0, 1), new Date(2012, 11, 31)])
      .range([graphPaddingHor, graphWidth - graphPaddingHor]);
    var xAxis = d3.svg.axis()
      .scale(timeScale)
      .tickFormat(d3.time.format("%b"))
      .orient("bottom");

    //Max count of tornadoes that have occurred on one day
    maxLength = d3.max(d3.values(tornadoDay), function(d) { return d.length; });

    tornadoGraph = graph.selectAll("rect")
      .data(d3.entries(tornadoDay))
      .enter().append("rect")
        .attr({
          "class": function(d) { return "toggle graph-path " + d.value[0].SEASON; },
          "x": function(d) {
            return (graphWidth - graphPaddingHor * 2) / 366 * d.key + graphPaddingHor;
          },
          "width": (graphWidth - graphPaddingHor * 2) / 366,
          "fill": function(d) { return seasonColor(d.value[0].SEASON); }
        });

    graph.append("g")
      .attr("class", "graph-axis")
  		.attr("transform", "translate(0," + (graphHeight - graphPaddingVert) + ")")
      .call(xAxis);

  }

  function createCompass() {
    //Add paths to diagram showing direction relative to compass
    tornadoComp = compass.selectAll("rect")
      .data(directionData)
      .enter().append("rect")
      .attr({
        "class": function(d) { return "toggle compass-path " + d.properties.SEASON; },
        "x": compassWidth / 2 + 2,
        "y": compassHeight / 2 - rectHeight / 2,
        "height": rectHeight,
        "transform": function(d) { return "rotate(" +
          -d.properties.ANGLE * (180 / Math.PI) + "," +
          compassWidth / 2 + "," + compassHeight / 2 + ")"; },
        "fill": function(d) { return seasonColor(d.properties.SEASON); }
      });

    //Add NS and EW axes
    var axes = compass.append("g")
      .attr("class", "axis");

    axes.append("rect")
      .attr({
        "class": "x axis-line",
        "x": compassWidth / 2 - minorLength / 2,
        "y": compassHeight / 2 - rectHeight / 2,
        "width": minorLength,
        "height": rectHeight
      });

      axes.append("rect")
      .attr({
        "class": "y axis-line",
        "x": compassWidth / 2 - rectHeight / 2,
        "y": compassHeight / 2 - minorLength / 2,
        "width": rectHeight,
        "height": minorLength
      });

    axes.append("text")
      .attr({
        "class": "svg-text",
        "x": compassWidth / 2 + -minorLength / 2 - 5,
        "y": compassHeight / 2,
        "font-size": 20,
        "alignment-baseline": "central",
        "text-anchor": "start"
      })
      .text("W");

    axes.append("text")
      .attr({
        "class": "svg-text",
        "x": compassWidth / 2 + minorLength / 2 + 5,
        "y": compassHeight / 2,
        "font-size": 20,
        "alignment-baseline": "central",
        "text-anchor": "end"
      })
      .text("E");

    axes.append("text")
      .attr({
        "class": "svg-text",
        "x": compassWidth / 2,
        "y": compassHeight / 2 + -minorLength / 2 - 5,
        "font-size": 20,
        "alignment-baseline": "hanging",
        "text-anchor": "middle"
      })
      .text("N");

    axes.append("text")
      .attr({
        "class": "svg-text",
        "x": compassWidth / 2,
        "y": compassHeight / 2 + minorLength / 2 + 5,
        "font-size": 20,
        "alignment-baseline": "baseline",
        "text-anchor": "middle"
      })
      .text("S");
  }

  function makeSlider() {
    var dateFormat = d3.time.format("%Y-%m-%d"),
    tornadoDate = d3.nest()
      .key(function(d) { return dateFormat(new Date(d.DATE)); })
      .map(tornadoes.features.map(function(d) { return d.properties; }) );

    sliderDate = +new Date(d3.keys(tornadoDate)[d3.keys(tornadoDate).length - 1]);

    var dateSlider = d3.select("#slider")
      .append("input")
      .attr({
        "class": "date-slider",
        "type": "range",
        "min": +new Date("May 11 1950 23:59:59"),
        "max": +new Date(d3.keys(tornadoDate)[d3.keys(tornadoDate).length - 1]),
        "step": 86400000,
        "value": sliderDate
      });

    makeSliderScale();

    //Make slider scale
    function makeSliderScale() {
      var sliderScale = d3.select(".slider-scale").append("svg")
          .attr({
            "class": "slider-scale-svg",
            "width": parseInt(dateSlider.style("width")),
            "height": 30
            // "shape-rendering": "crispEdges"
          });

      var timeScale = d3.time.scale()
        .domain([
          new Date("May 11 1950 23:59:59"),
          new Date(d3.keys(tornadoDate)[d3.keys(tornadoDate).length - 1])
        ])
        .range([8, parseInt(dateSlider.style("width")) - 8]); //take width of slider-thumb into account for padding
      var xAxis = d3.svg.axis()
        .scale(timeScale)
        .tickFormat(d3.time.format("%Y"))
        .ticks(d3.time.years, 4)
        .orient("bottom");

        sliderScale.append("g")
        .attr("class", "slider-axis")
    		.attr("transform", "translate(0,8)")
        .call(xAxis);
    }

    //Draw everything
    updateVis(sliderDate);

    //Filter and update data based on slider position
    var sliderTextFormat = d3.time.format("%b %d, %Y");
    dateSlider.on("input", function() {
      sliderDate = this.value;

      d3.select(".slider-text")
        .text(sliderTextFormat(new Date(parseInt(sliderDate))));

      console.log(sliderDate)

      tornadoGeo.classed("dateOff", function(d) {
        return new Date(d.properties.DATE) >= new Date(parseInt(sliderDate)); });
      tornadoComp.classed("dateOff", function(d) {
        return new Date(d.properties.DATE) >= new Date(parseInt(sliderDate)); });

      updateVis(sliderDate);
    });
  }

  //Animate map, graph, and compass on data filter change (date or season)
  function updateVis(date) {

    //Remove lines from map that have not occured before slider 'date'
    tornadoGeo.transition()
      .attr("stroke-dashoffset", function(d) {
        return d3.select(this).classed("dateOff") ||
          d3.select(this).classed("seasonOff") ? this.getTotalLength() : 0;
      });

    //Remove lines from compass that have not occured before slider 'date'
    tornadoComp.transition()
      .attr("width", function(d) { return d3.select(this).classed("dateOff") ||
        d3.select(this).classed("seasonOff") ?
        0 : (d.properties.MAG_INT + 1) / 5 * minorLength / 2 - 10;
      });

    //Change bar graph height to reflect tornados occuring before slider 'date'
    tornadoGraph.transition()
      .attr({
        "y": function(d) {
          return d3.select(this).classed("seasonOff") ?
            graphHeight - graphPaddingVert :
            graphHeight - graphPaddingVert -
            (graphHeight - graphPaddingVert * 2) *
            (d.value.filter(filterByDate).length / maxLength);
        },
        "height": function(d) {
          return d3.select(this).classed("seasonOff") ?
            0 :
            (graphHeight - graphPaddingVert * 2) *
            (d.value.filter(filterByDate).length / maxLength);
        }
      });

    //Filter tornado graph data to change bar height
    function filterByDate(torDate) {
      return new Date(torDate.DATE) <= new Date(parseInt(date));
    }

  }

});

// function earthquakePopups(feature, layer) {
//   layer.bindPopup("<h5>"+feature.properties.place+
//     "</h5><p><strong>Magnitude: </strong>"+feature.properties.mag+
//     "</p><p><strong>Depth: </strong>"+feature.geometry.coordinates[2]+" km"+
//     "</p><p><strong>Time: </strong>"+new Date(feature.properties.time)+
//     "</p><a href="+feature.properties.url+"><p>More info</p></a>");
// }
