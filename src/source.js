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

  const tripDateIdx = fieldIndices.tripDate;
  const vehicleIdIdx = fieldIndices.vehicleId;
  const driverIdIdx = fieldIndices.driverId;
  const runStartTimeIdx = fieldIndices.runStartTime;
  const runEndTimeIdx = fieldIndices.runEndTime;
  const customerIdIdx = fieldIndices.customerId;
  const puTimeIdx = fieldIndices.puTime;
  const doTimeIdx = fieldIndices.doTime;
  const puAddressIdx = fieldIndices.puAddress;
  const doAddressIdx = fieldIndices.doAddress;

  console.log('Field indices:', {
    tripDateIdx,
    vehicleIdIdx,
    driverIdIdx,
    runStartTimeIdx,
    runEndTimeIdx,
    customerIdIdx,
    puTimeIdx,
    doTimeIdx,
    puAddressIdx,
    doAddressIdx
  });

  // Group trips by composite key: tripDate + vehicleId + driverId
  const runGroups = {};

  console.log('Processing rows...');

  if (rows.length === 0) {
    console.warn('No rows to process');
    return { runs: [] };
  }

  // Filter out rows where tripDate is null
  const validRows = rows.filter(row => row[tripDateIdx] != null);
  console.log('Valid rows after filtering nulls:', validRows.length);

  validRows.forEach((row, index) => {
    if (index < 3) {
      console.log(`Row ${index}:`, row);
    }

    const tripDate = row[tripDateIdx];
    const vehicleId = row[vehicleIdIdx] || 'Unassigned';
    const driverId = row[driverIdIdx] || 'Unassigned';
    const runStartTime = row[runStartTimeIdx];
    const runEndTime = row[runEndTimeIdx];
    const customerId = row[customerIdIdx];
    const puTime = row[puTimeIdx];
    const doTime = row[doTimeIdx];
    const puAddress = row[puAddressIdx];
    const doAddress = row[doAddressIdx];

    if (index < 3) {
      console.log(`Row ${index} values:`, {
        tripDate,
        vehicleId,
        driverId,
        runStartTime,
        runEndTime,
        customerId,
        puTime,
        doTime,
        puAddress,
        doAddress
      });
    }

    if (!tripDate) {
      console.log(`Row ${index}: skipping - no tripDate`);
      return;
    }

    // Create composite key
    const runKey = `${tripDate}|${vehicleId}|${driverId}`;

    if (!runGroups[runKey]) {
      runGroups[runKey] = {
        tripDate: tripDate,
        vehicleId: vehicleId,
        driverId: driverId,
        runStartTime: formatTimeValue(runStartTime),
        runEndTime: formatTimeValue(runEndTime),
        trips: []
      };
    }

    runGroups[runKey].trips.push({
      tripId: customerId,
      pickupTime: formatTimeValue(puTime),
      dropoffTime: formatTimeValue(doTime),
      pickupLocation: puAddress,
      dropoffLocation: doAddress
    });
  });

  console.log('Run groups created:', runGroups);

  // Convert to runs array
  const runs = [];
  for (let runKey in runGroups) {
    const run = runGroups[runKey];

    // Sort trips by pickup time
    run.trips.sort((a, b) => {
      if (a.pickupTime < b.pickupTime) return -1;
      if (a.pickupTime > b.pickupTime) return 1;
      return 0;
    });

    runs.push(run);
  }

  // Sort runs: by vehicleId, then by driverId
  runs.sort((a, b) => {
    if (a.vehicleId < b.vehicleId) return -1;
    if (a.vehicleId > b.vehicleId) return 1;
    // Same vehicle, sort by driver
    if (a.driverId < b.driverId) return -1;
    if (a.driverId > b.driverId) return 1;
    return 0;
  });

  console.log('Runs created and sorted:', runs);
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
  let runFillColor = '#f0f9ff';
  let runBorderColor = '#bfdbfe';
  let runBorderWidth = 1;
  let runOpacity = 0.5;

  try {
    // Try flat structure first (actual Looker Studio format)
    if (styleConfig) {
      lineColor = styleConfig.lineColor?.value?.color || lineColor;
      pickupColor = styleConfig.pickupColor?.value?.color || pickupColor;
      dropoffColor = styleConfig.dropoffColor?.value?.color || dropoffColor;
      runFillColor = styleConfig.runFillColor?.value?.color || runFillColor;
      runBorderColor = styleConfig.runBorderColor?.value?.color || runBorderColor;
      runBorderWidth = styleConfig.runBorderWidth?.value || runBorderWidth;
      runOpacity = styleConfig.runOpacity?.value || runOpacity;
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

  // Collect all times (trips + run schedules)
  const allTimes = [];
  data.runs.forEach(run => {
    // Add run schedule times
    if (run.runStartTime) {
      const runStart = parseTime(run.runStartTime);
      if (runStart) allTimes.push(runStart);
    }
    if (run.runEndTime) {
      const runEnd = parseTime(run.runEndTime);
      if (runEnd) allTimes.push(runEnd);
    }

    // Add trip times
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

  // Vehicle scale - create composite identifier for each run
  const runIds = data.runs.map(r => `${r.vehicleId}|${r.driverId}`);

  const yScale = d3.scaleBand()
    .domain(runIds)
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

  // Draw Y axis with two-line labels
  const yAxis = d3.axisLeft(yScale)
    .tickSize(0)
    .tickPadding(10)
    .tickFormat(d => {
      // Return composite ID for now, will be replaced with tspans
      return d;
    });

  const yAxisGroup = svg.append('g')
    .attr('class', 'y-axis')
    .call(yAxis);

  // Replace text labels with two-line labels
  yAxisGroup.selectAll('text')
    .text('')  // Clear default text
    .each(function(d) {
      const [vehicleId, driverId] = d.split('|');
      const text = d3.select(this);

      // Vehicle ID on first line
      text.append('tspan')
        .attr('x', -10)
        .attr('dy', '-0.3em')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text(vehicleId);

      // Driver ID on second line
      text.append('tspan')
        .attr('x', -10)
        .attr('dy', '1.2em')
        .style('font-size', '12px')
        .style('font-weight', '400')
        .style('fill', '#666')
        .text(driverId);
    });

  // Remove Y-axis line
  yAxisGroup.select('path').remove();

  // Draw horizontal lines between runs
  runIds.forEach((runId, index) => {
    if (index > 0) {
      const yPosition = yScale(runId);
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
    .style('font-size', '18px')
    .text('Time');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -80)
    .style('text-anchor', 'middle')
    .style('font-size', '18px')
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

  // Draw run schedule rectangles (background)
  data.runs.forEach(run => {
    const runId = `${run.vehicleId}|${run.driverId}`;
    const runYBase = yScale(runId);
    const runBandHeight = yScale.bandwidth();

    if (run.runStartTime && run.runEndTime) {
      const runStartParsed = parseTime(run.runStartTime);
      const runEndParsed = parseTime(run.runEndTime);

      if (runStartParsed && runEndParsed) {
        const x1 = xScale(runStartParsed);
        const x2 = xScale(runEndParsed);

        // Draw run schedule rectangle
        svg.append('rect')
          .attr('x', x1)
          .attr('y', runYBase)
          .attr('rx', 5)
          .attr('ry', 5)
          .attr('width', x2 - x1)
          .attr('height', runBandHeight)
          .attr('fill', runFillColor)
          .attr('stroke', runBorderColor)
          .attr('stroke-width', runBorderWidth)
          .attr('opacity', runOpacity);
      }
    }
  });

  // Draw trips
  data.runs.forEach(run => {
    const runId = `${run.vehicleId}|${run.driverId}`;
    const vehicleYBase = yScale(runId);
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
            <div style="font-weight: 600; margin-bottom: 4px">
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
