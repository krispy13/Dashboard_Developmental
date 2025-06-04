"use client"
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { Card } from '@/components/ui/card';
import { useTheme } from 'next-themes';

const ChoroplethMap = ({ 
  width = 810, 
  height = 430,
  className = "",
  colorScheme = "default",
  onCountyClick,
  indices = [0],
  activeIndices = [-1],
  inactiveIndices = [-2]
}) => {
  const mapRef = useRef(null);
  const legendRef = useRef(null);
  const [data, setData] = useState(new Map());
  const [geoData, setGeoData] = useState(null);
  const [containerHeight, setContainerHeight] = useState(0);

  const selectedIndices = indices ? indices : [];
  const { theme } = useTheme();

  // Set container height to 45% of viewport height
  useEffect(() => {
    const updateHeight = () => {
      // Set height to 45% of viewport height
      const viewportHeight = window.innerHeight;
      setContainerHeight(viewportHeight * 0.44);
    };

    // Initial height calculation
    updateHeight();

    // Update height on window resize
    window.addEventListener('resize', updateHeight);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  // Load data
  useEffect(() => {
    Promise.all([
      d3.csv('/data/county-data.csv'),
      d3.json('/data/counties-topology.json')
    ]).then(([csvData, topoData]) => {
      const dataMap = new Map();
      csvData.forEach(row => {
        const fips = row.FIPS.padStart(5, '0');
        const processedRow = {
          ...row,
          deathRate: parseFloat(row['death-rate-2013-2016'])
        };
        dataMap.set(fips, processedRow);
      });
      
      setData(dataMap);
      setGeoData(topoData);
    }).catch(error => {
      console.error('Error loading data:', error);
    });
  }, []);

  // Create visualization
  useEffect(() => {
    if (!geoData || !data.size || !mapRef.current) return;

    // Get current theme
    const isDarkTheme = theme === 'dark';
    
    // Colors based on current theme
    const countyStrokeColor = isDarkTheme ? 'hsl(215 27.9% 86.9%)' : '#000  ';
    const borderStrokeColor = isDarkTheme ? 'hsl(215 27.9% 90%)' : '#000';

    // Dynamically determine the dimensions of the container element
    const container = mapRef.current;
    const { width: dynamicWidth } = container.getBoundingClientRect();

    // Clear previous content
    d3.select(mapRef.current).selectAll("*").remove();
    d3.select(legendRef.current).selectAll("*").remove();

    const dynamicHeight = containerHeight - 30;
    
    // Create SVG
    const svg = d3.select(mapRef.current)
      .append('svg')
      .attr('width', dynamicWidth)
      .attr('height', dynamicHeight)
      .attr('viewBox', [0, 0, dynamicWidth, dynamicHeight+30])
      .attr('style', 'max-width: 100%; height: auto;');

    // Create color scales
    const deathRates = Array.from(data.values()).map(d => d.deathRate);
    
    
    // Blue scale for inactive counties
    const blueScale = d3.scaleQuantile()
      .domain(deathRates)
      .range(d3.schemeBlues[9]);
    
    // Red scale for active counties
    const redScale = d3.scaleQuantile()
      .domain(deathRates)
      .range(d3.schemeReds[9]);
    
    // Default scale (when not using dual coloring)
    const defaultScale = d3.scaleQuantile()
      .domain(deathRates)
      .range(d3.schemeBlues[9]);

    // Setup zoom
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        g.attr('stroke-width', `${1 / event.transform.k}`);
      });

    // Convert TopoJSON to GeoJSON
    const counties = topojson.feature(geoData, geoData.objects.counties);
    const stateBorders = topojson.mesh(geoData, geoData.objects.states);
    const countryBorder = topojson.mesh(geoData, geoData.objects.counties);

    // Setup projection
    const projection = d3.geoIdentity()
      .fitSize([dynamicWidth, dynamicHeight], counties);

    const path = d3.geoPath(projection);

    const g = svg.append('g');

    // Create tooltip
    const tooltip = d3.select(mapRef.current)
      .append('div')
      .attr('class', 'absolute hidden bg-white p-2 rounded shadow-lg text-sm')
      .style('pointer-events', 'none');

    // Function to determine if a county is active or inactive
    const isActiveCounty = (id) => {
      return activeIndices.includes(Number(id));
    };

    const isInactiveCounty = (id) => {
      return inactiveIndices.includes(Number(id));
    };

    // Function to determine fill color based on colorScheme
    const getFillColor = (d) => {
      const countyData = data.get(d.id);
      
      if (!countyData) return '#ccc';

      // Handle dual coloring for the "all" view
      if (colorScheme === "dual") {
        if (isActiveCounty(d.id)) {
          return redScale(countyData.deathRate);
        } else if (isInactiveCounty(d.id)) {
          return blueScale(countyData.deathRate);
        } else {
          return '#ccc'; // Counties not in either set
        }
      } 
      // Use specific colors based on single colorScheme
      else if (colorScheme === "active") {
        return redScale(countyData.deathRate);
      } else if (colorScheme === "inactive") {
        return blueScale(countyData.deathRate);
      } else {
        return defaultScale(countyData.deathRate);
      }
    };

    // Function to determine opacity based on selection
    const getOpacity = (d) => {
      if (colorScheme === "dual" || colorScheme === "default") {
        // In dual mode, highlight both active and inactive counties
        return (isActiveCounty(d.id) || isInactiveCounty(d.id)) ? 1 : 0.15;
      } else {
        // In other modes, use the provided indices
        return selectedIndices.includes(Number(d.id)) ? 1 : 0.2;
      }
    };

    // Determine which color scale to use for the legend
    const getLegendColorScale = () => {
      if (colorScheme === "active") return redScale;
      if (colorScheme === "inactive") return blueScale;
      return defaultScale;
    };

    // Draw counties
    g.selectAll('path')
      .data(counties.features)
      .join('path')
      .attr('d', path)
      .attr('fill', getFillColor)
      .attr('opacity', getOpacity)
      .attr('stroke', countyStrokeColor)
      .attr('stroke-width', 0.2)
      .attr('vector-effect', 'non-scaling-stroke')
      .on('mouseover', (event, d) => {
        const countyData = data.get(d.id);
        if (countyData) {
          // Determine county status for tooltip
          let status = "Not in selection";
          if (isActiveCounty(d.id)) status = "Active";
          if (isInactiveCounty(d.id)) status = "Inactive";
          
          tooltip
            .style('display', 'block')
            .style('color', 'black')
            .html(`
              <div class="font-medium">${d.properties.name}</div>
              <div>Death Rate: ${countyData.deathRate.toFixed(2)}</div>
              ${colorScheme === "dual" ? `<div>Status: ${status}</div>` : ''}
            `);
        }
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.clientX - 10}px`)
          .style('top', `${event.clientY - 150}px`);
      })
      .on('mouseout', () => {
        tooltip.style('display', 'none');
      })
      .on('click', (event, d) => {
        // Only trigger callback if county is in our selection
        const isInSelection = colorScheme === "dual" 
          ? (isActiveCounty(d.id) || isInactiveCounty(d.id))
          : selectedIndices.includes(Number(d.id));
          
        if (isInSelection) {
          onCountyClick(Number(d.id));
        }
      });

    // Draw state borders
    g.append('path')
      .datum(stateBorders)
      .attr('fill', 'none')
      .attr('stroke', borderStrokeColor)
      .attr('stroke-width', 0.8)
      .attr('opacity', 0.5)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('d', path);

    // Draw country border
    g.append('path')
      .datum(countryBorder)
      .attr('fill', 'none')
      .attr('stroke', borderStrokeColor) 
      .attr('stroke-width', 0.25) 
      .attr('opacity', 0.5)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('d', path);

    // Create legend
    if (colorScheme !== "dual") {
      // Single color legend for non-dual modes
      const legendHeight = 50;
      const legendWidth = 300;
      const legend = svg.append('g')
        .attr('transform', `translate(${dynamicWidth - legendWidth - 30}, ${dynamicHeight - legendHeight + 50})`);

      const legendScale = d3.scaleLinear()
        .domain(d3.extent(deathRates))
        .range([0, legendWidth]);

      const legendAxis = d3.axisBottom(legendScale)
        .ticks(8)
        .tickFormat(d => d.toFixed(1));

      // Create gradient
      const defs = svg.append('defs');
      const gradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%')
        .attr('y1', '0%')
        .attr('y2', '0%');

      const selectedColorScale = getLegendColorScale();
      const numStops = 5;
      const step = (d3.extent(deathRates)[1] - d3.extent(deathRates)[0]) / (numStops - 1);

      gradient.selectAll('stop')
        .data(d3.range(numStops).map(i => d3.extent(deathRates)[0] + i * step))
        .join('stop')
        .attr('offset', (d, i) => `${(i / (numStops - 1)) * 100}%`)
        .attr('stop-color', d => selectedColorScale(d));

      legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', 10)
        .attr('stroke', '#000')
        .style('fill', 'url(#legend-gradient)');

      legend.append('g')
        .attr('transform', `translate(0, 10)`)
        .call(legendAxis);
    } else {
      // Dual color legend for the "all" view
      const legendHeight = 90;
      const legendWidth = 300;
      const legend = svg.append('g')
        .attr('transform', `translate(${dynamicWidth - legendWidth - 30}, ${dynamicHeight - legendHeight + 50})`);

      // Title for the legend
      legend.append('text')
        .attr('x', 0)
        .attr('y', -10)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'start')
        .attr('font-weight', 'bold')
        .attr('font-size', '12px')
        .text('Death Rate by County Status');
      
      // Active counties legend (red)
      legend.append('text')
        .attr('x', 0)
        .attr('y', 10)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'start')
        .attr('font-size', '10px')
        .text('Active Counties:');

      const activeGradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'active-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%')
        .attr('y1', '0%')
        .attr('y2', '0%');

      const numStops = 5;
      const step = (d3.extent(deathRates)[1] - d3.extent(deathRates)[0]) / (numStops - 1);

      activeGradient.selectAll('stop')
        .data(d3.range(numStops).map(i => d3.extent(deathRates)[0] + i * step))
        .join('stop')
        .attr('offset', (d, i) => `${(i / (numStops - 1)) * 100}%`)
        .attr('stop-color', d => redScale(d));

      legend.append('rect')
        .attr('x', 100)
        .attr('y', 5)
        .attr('width', legendWidth - 100)
        .attr('height', 8)
        .attr('stroke', '#000')
        .style('fill', 'url(#active-gradient)');

      // Inactive counties legend (blue)
      legend.append('text')
        .attr('x', 0)
        .attr('y', 40)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'start')
        .attr('font-size', '10px')
        .text('Inactive Counties:');

      const inactiveGradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'inactive-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%')
        .attr('y1', '0%')
        .attr('y2', '0%');

      inactiveGradient.selectAll('stop')
        .data(d3.range(numStops).map(i => d3.extent(deathRates)[0] + i * step))
        .join('stop')
        .attr('offset', (d, i) => `${(i / (numStops - 1)) * 100}%`)
        .attr('stop-color', d => blueScale(d));

      legend.append('rect')
        .attr('x', 100)
        .attr('y', 35)
        .attr('width', legendWidth - 100)
        .attr('height', 8)
        .attr('stroke', '#000')
        .style('fill', 'url(#inactive-gradient)');

      // Add scale labels
      const legendScale = d3.scaleLinear()
        .domain(d3.extent(deathRates))
        .range([100, legendWidth]);

      const legendAxis = d3.axisBottom(legendScale)
        .ticks(4)
        .tickFormat(d => d.toFixed(1));

      legend.append('g')
        .attr('transform', `translate(0, 50)`)
        .call(legendAxis);

      legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', 70)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px');
    }

    // Add zoom behavior
    svg.call(zoom);

    // Reset zoom on double click
    svg.on('dblclick', () => {
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    });

  }, [geoData, data, width, height, indices, activeIndices, inactiveIndices, colorScheme, containerHeight]);

  return (
    <Card className={className}>
      <div className="p-4">
        {!geoData ? (
          <div className="flex h-[43vh] items-center justify-center">
            Loading...
          </div>
        ) : (
          <div ref={mapRef} className="w-full relative" />
        )}
      </div>
    </Card>
  );
};

export default ChoroplethMap;