/**
 * Transit Timeline - Looker Studio Community Visualization
 * Main JavaScript file
 */

/**
 * Main entry point - called by Looker Studio with data
 */
function drawViz(data) {
  console.log('drawViz called with data:', data);

  // Clear any existing content
  const container = document.getElementById('container');
  if (!container) {
    const newContainer = document.createElement('div');
    newContainer.id = 'container';
    document.body.appendChild(newContainer);
    console.log('Created container element');
  }

  try {
    // Transform Looker Studio data to visualization format
    console.log('Transforming data...');
    const transformedData = transformLookerData(data);
    console.log('Transformed data:', transformedData);

    // Render visualization
    console.log('Rendering timeline...');
    renderTimeline('container', transformedData, data.style);
    console.log('Render complete');
  } catch (error) {
    console.error('Error in drawViz:', error);
    showError('Error rendering visualization: ' + error.message);
  }
}

/**
 * Transform Looker Studio row-based data to hierarchical trips structure
 */
function transformLookerData(data) {
  console.log('transformLookerData - input data:', data);

  if (!data || !data.tables || !data.tables.DEFAULT) {
    const error = 'No data received from Looker Studio';
    console.error(error);
    throw new Error(error);
  }

  const table = data.tables.DEFAULT;

  console.log('Table data:', table);
  console.log('Table type:', typeof table);

  // Get headers and rows
  const headers = table.headers || [];
  const rows = table.rows || [];

  console.log('Headers:', headers);
  console.log('Number of rows:', rows.length);

  // Build field index map from headers using configId
  const fieldIndices = {};
  headers.forEach((header, index) => {
    if (header.configId) {
      fieldIndices[header.configId] = index;
    }
  });

  console.log('Field indices map:', fieldIndices);

  const vehicleIdIdx = fieldIndices.vehicleId;
  const customerIdIdx = fieldIndices.customerId;
  const puTimeIdx = fieldIndices.puTime;
  const doTimeIdx = fieldIndices.doTime;
  const puAddressIdx = fieldIndices.puAddress;
  const doAddressIdx = fieldIndices.doAddress;

  console.log('Field indices:', {
    vehicleIdIdx,
    customerIdIdx,
    puTimeIdx,
    doTimeIdx,
    puAddressIdx,
    doAddressIdx
  });

  // Group trips by vehicle
  const vehicleTrips = {};

  console.log('Processing rows...');

  if (!Array.isArray(rows)) {
    throw new Error('Rows is not an array. Type: ' + typeof rows);
  }

  if (rows.length === 0) {
    console.warn('No rows to process');
    return { runs: [] };
  }

  // Filter out rows where vehicleId is null
  const validRows = rows.filter(row => row[vehicleIdIdx] != null);
  console.log('Valid rows after filtering nulls:', validRows.length);

  validRows.forEach((row, index) => {
    if (index < 3) {
      console.log(`Row ${index}:`, row);
    }

    const vehicleId = row[vehicleIdIdx];
    const customerId = row[customerIdIdx];
    const puTime = row[puTimeIdx];
    const doTime = row[doTimeIdx];
    const puAddress = row[puAddressIdx];
    const doAddress = row[doAddressIdx];

    if (index < 3) {
      console.log(`Row ${index} values:`, {
        vehicleId,
        customerId,
        puTime,
        doTime,
        puAddress,
        doAddress
      });
    }

    if (!vehicleId) {
      console.log(`Row ${index}: skipping - no vehicleId`);
      return;
    }

    if (!vehicleTrips[vehicleId]) {
      vehicleTrips[vehicleId] = [];
    }

    vehicleTrips[vehicleId].push({
      tripId: customerId,
      pickupTime: formatTimeValue(puTime),
      dropoffTime: formatTimeValue(doTime),
      pickupLocation: puAddress,
      dropoffLocation: doAddress
    });
  });

  console.log('Vehicle trips grouped:', vehicleTrips);

  // Convert to runs array and sort
  const runs = [];
  for (let vehicleId in vehicleTrips) {
    // Sort trips by pickup time
    vehicleTrips[vehicleId].sort((a, b) => {
      if (a.pickupTime < b.pickupTime) return -1;
      if (a.pickupTime > b.pickupTime) return 1;
      return 0;
    });

    runs.push({
      vehicleId: vehicleId,
      trips: vehicleTrips[vehicleId]
    });
  }

  console.log('Runs created:', runs);
  console.log('Returning data with', runs.length, 'runs');

  return { runs: runs };
}

/**
 * Format time value from Looker Studio to HH:MM format
 */
function formatTimeValue(value) {
  if (typeof value === 'string') {
    // If already has AM/PM, return as-is
    if (value.match(/AM|PM/i)) {
      return value;
    }

    // If already in HH:MM 24-hour format
    if (value.match(/^\d{1,2}:\d{2}$/)) {
      const parts = value.split(':');
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1].padStart(2, '0');
      return hours + ':' + minutes;
    }
  }

  // Try to parse as date/time object
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return hours + ':' + minutes;
  }

  return String(value);
}

/**
 * Render the timeline visualization
 */
function renderTimeline(containerId, data, styleConfig) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // Debug logging
  console.log('renderTimeline called');
  console.log('data:', data);
  console.log('styleConfig:', styleConfig);

  // Create SVG container
  const svgContainer = document.createElement('div');
  container.appendChild(svgContainer);

  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  container.appendChild(tooltip);

  // Get style values - handle both grouped and flat structures
  let lineColor = '#2563eb';
  let pickupColor = '#10b981';
  let dropoffColor = '#ef4444';

  try {
    console.log('Style config:', styleConfig);

    // Try flat structure first (actual Looker Studio format)
    if (styleConfig) {
      lineColor = styleConfig.lineColor?.value?.color || lineColor;
      pickupColor = styleConfig.pickupColor?.value?.color || pickupColor;
      dropoffColor = styleConfig.dropoffColor?.value?.color || dropoffColor;

      console.log('Applied colors:', { lineColor, pickupColor, dropoffColor });
    }
  } catch (error) {
    console.error('Error accessing style config:', error);
  }

  // Dimensions
  const margin = { top: 40, right: 60, bottom: 40, left: 120 };
  const width = 1000 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Create SVG
  const svg = d3.select(svgContainer)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Parse time - handle 12-hour AM/PM format
  const parseTime = d3.timeParse('%I:%M %p');
  const formatTime = d3.timeFormat('%I:%M %p');

  // Collect all times
  const allTimes = [];
  data.runs.forEach(run => {
    run.trips.forEach(trip => {
      allTimes.push(parseTime(trip.pickupTime));
      allTimes.push(parseTime(trip.dropoffTime));
    });
  });

  const timeExtent = d3.extent(allTimes);
  const paddingMinutes = 10;

  // Time scale
  const xScale = d3.scaleTime()
    .domain([
      d3.timeMinute.offset(timeExtent[0], -paddingMinutes),
      d3.timeMinute.offset(timeExtent[1], paddingMinutes)
    ])
    .range([0, width]);

  // Vehicle scale - sort vehicles alphabetically
  const yScale = d3.scaleBand()
    .domain(data.runs.map(r => r.vehicleId).sort())
    .range([0, height])
    .padding(0.3);

  const lineSpacing = 10;

  // Draw X axis
  const xAxis = d3.axisBottom(xScale)
    .ticks(d3.timeHour.every(1))
    .tickFormat(formatTime);

  svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis)
    .selectAll('text')
    .style('font-size', '12px');

  // Draw vertical grid lines
  const xTicks = xScale.ticks(d3.timeHour.every(1));
  xTicks.forEach(tick => {
    svg.append('line')
      .attr('x1', xScale(tick))
      .attr('x2', xScale(tick))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');
  });

  // Draw Y axis
  const yAxis = d3.axisLeft(yScale)
    .tickSize(0)
    .tickPadding(10);

  svg.append('g')
    .attr('class', 'y-axis')
    .call(yAxis)
    .selectAll('text')
    .style('font-size', '14px')
    .style('font-weight', '500')
    .attr('dy', '0.35em'); // Center text vertically

  // Remove Y-axis line
  svg.select('.y-axis path').remove();

  // Draw horizontal lines between vehicles
  const vehicles = data.runs.map(r => r.vehicleId);
  vehicles.forEach((vehicleId, index) => {
    if (index > 0) {
      const yPosition = yScale(vehicleId);
      svg.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', yPosition)
        .attr('y2', yPosition)
        .attr('stroke', '#d1d5db')
        .attr('stroke-width', 1);
    }
  });

  // Add axis labels
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + 35)
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('Time');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -80)
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('Vehicle');

  // Lane assignment function
  function assignLanes(trips, parseTime) {
    const tripsWithTimes = trips.map(trip => ({
      ...trip,
      pickupTimestamp: parseTime(trip.pickupTime).getTime(),
      dropoffTimestamp: parseTime(trip.dropoffTime).getTime()
    }));

    tripsWithTimes.sort((a, b) => {
      if (a.pickupTimestamp !== b.pickupTimestamp) {
        return a.pickupTimestamp - b.pickupTimestamp;
      }
      return a.dropoffTimestamp - b.dropoffTimestamp;
    });

    const lanes = [];
    tripsWithTimes.forEach(trip => {
      let assignedLane = -1;
      for (let i = 0; i < lanes.length; i++) {
        const lastTripInLane = lanes[i][lanes[i].length - 1];
        if (lastTripInLane.dropoffTimestamp <= trip.pickupTimestamp) {
          assignedLane = i;
          break;
        }
      }

      if (assignedLane === -1) {
        assignedLane = lanes.length;
        lanes.push([]);
      }

      trip.lane = assignedLane;
      lanes[assignedLane].push(trip);
    });

    return tripsWithTimes;
  }

  // Draw trips
  data.runs.forEach(run => {
    const vehicleYBase = yScale(run.vehicleId);
    const vehicleBandHeight = yScale.bandwidth();

    const tripsWithLanes = assignLanes(run.trips, parseTime);

    // Calculate maximum lane number to determine bundle height
    const maxLane = Math.max(...tripsWithLanes.map(t => t.lane));
    const bundleHeight = (maxLane + 1) * lineSpacing;

    // Center the bundle within the vehicle band
    const yOffset = vehicleYBase + (vehicleBandHeight - bundleHeight) / 2;

    tripsWithLanes.forEach((trip) => {
      const yPosition = yOffset + trip.lane * lineSpacing;
      const x1 = xScale(parseTime(trip.pickupTime));
      const x2 = xScale(parseTime(trip.dropoffTime));

      // Trip line
      const tripLine = svg.append('line')
        .attr('x1', x1)
        .attr('x2', x2)
        .attr('y1', yPosition)
        .attr('y2', yPosition)
        .attr('stroke', lineColor)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.7)
        .attr('stroke-linecap', 'round')
        .style('cursor', 'pointer');

      // Hover on line
      tripLine
        .on('mouseenter', function(event) {
          d3.select(this)
            .transition()
            .duration(100)
            .attr('stroke-width', 3)
            .attr('stroke-opacity', 1);

          tooltip.style.opacity = '1';
          tooltip.style.left = (event.pageX + 10) + 'px';
          tooltip.style.top = (event.pageY - 10) + 'px';
          tooltip.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px; color: ${lineColor}">
              ${trip.tripId}
            </div>
            <div style="margin-bottom: 2px"><strong>Pickup:</strong> ${trip.pickupTime}</div>
            <div style="margin-bottom: 2px; padding-left: 10px; font-size: 12px">${trip.pickupLocation}</div>
            <div style="margin-bottom: 2px"><strong>Dropoff:</strong> ${trip.dropoffTime}</div>
            <div style="padding-left: 10px; font-size: 12px">${trip.dropoffLocation}</div>
          `;
        })
        .on('mouseleave', function() {
          d3.select(this)
            .transition()
            .duration(100)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.7);

          tooltip.style.opacity = '0';
        });

      // Pickup marker
      const pickupGroup = svg.append('g')
        .style('cursor', 'pointer');

      pickupGroup.append('circle')
        .attr('cx', x1)
        .attr('cy', yPosition)
        .attr('r', 4)
        .attr('fill', pickupColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);

      pickupGroup
        .on('mouseenter', function(event) {
          d3.select(this).select('circle')
            .transition()
            .duration(100)
            .attr('r', 6);

          tooltip.style.opacity = '1';
          tooltip.style.left = (event.pageX + 10) + 'px';
          tooltip.style.top = (event.pageY - 10) + 'px';
          tooltip.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px; color: ${pickupColor}">
              PICKUP
            </div>
            <div style="margin-bottom: 2px"><strong>Trip:</strong> ${trip.tripId}</div>
            <div style="margin-bottom: 2px"><strong>Time:</strong> ${trip.pickupTime}</div>
            <div><strong>Location:</strong> ${trip.pickupLocation}</div>
          `;
        })
        .on('mouseleave', function() {
          d3.select(this).select('circle')
            .transition()
            .duration(100)
            .attr('r', 4);

          tooltip.style.opacity = '0';
        });

      // Dropoff marker
      const dropoffGroup = svg.append('g')
        .style('cursor', 'pointer');

      dropoffGroup.append('circle')
        .attr('cx', x2)
        .attr('cy', yPosition)
        .attr('r', 4)
        .attr('fill', dropoffColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);

      dropoffGroup
        .on('mouseenter', function(event) {
          d3.select(this).select('circle')
            .transition()
            .duration(100)
            .attr('r', 6);

          tooltip.style.opacity = '1';
          tooltip.style.left = (event.pageX + 10) + 'px';
          tooltip.style.top = (event.pageY - 10) + 'px';
          tooltip.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px; color: ${dropoffColor}">
              DROPOFF
            </div>
            <div style="margin-bottom: 2px"><strong>Trip:</strong> ${trip.tripId}</div>
            <div style="margin-bottom: 2px"><strong>Time:</strong> ${trip.dropoffTime}</div>
            <div><strong>Location:</strong> ${trip.dropoffLocation}</div>
          `;
        })
        .on('mouseleave', function() {
          d3.select(this).select('circle')
            .transition()
            .duration(100)
            .attr('r', 4);

          tooltip.style.opacity = '0';
        });
    });
  });
}

/**
 * Show error message
 */
function showError(message) {
  const container = document.getElementById('container') || document.body;
  container.innerHTML = `
    <div style="padding: 20px; background: #fee; color: #c00; border-radius: 4px;">
      <strong>Error:</strong> ${message}
    </div>
  `;
}

// Subscribe to data changes from Looker Studio
if (typeof dscc !== 'undefined' && dscc.subscribeToData) {
  dscc.subscribeToData(drawViz, { transform: dscc.tableTransform });
}
