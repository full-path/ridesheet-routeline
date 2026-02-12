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
  }

  try {
    // Transform Looker Studio data to visualization format
    const transformedData = transformLookerData(data);
    console.log('Transformed data:', transformedData);

    // Render visualization
    renderTimeline('container', transformedData, data.style);
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
  const tripVehicleIdIdx = fieldIndices.tripVehicleId;
  const tripDriverIdIdx = fieldIndices.tripDriverId;
  const customerIdIdx = fieldIndices.customerId;
  const puTimeIdx = fieldIndices.puTime;
  const doTimeIdx = fieldIndices.doTime;
  const puAddressIdx = fieldIndices.puAddress;
  const doAddressIdx = fieldIndices.doAddress;
  const runDateIdx = fieldIndices.runDate;
  const runVehicleIdIdx = fieldIndices.runVehicleId;
  const runDriverIdIdx = fieldIndices.runDriverId;
  const runStartTimeIdx = fieldIndices.runStartTime;
  const runEndTimeIdx = fieldIndices.runEndTime;

  const runGroups = {};

  console.log('Processing rows...');
  if (rows.length === 0) {
    console.warn('No rows to process');
    return { runDates: [] };
  }

  // Filter out rows where both tripDate and runDate is null
  const validRows = rows.filter(row => row[tripDateIdx] || row[runDateIdx]);
  console.log('Valid rows after filtering nulls:', validRows);

  validRows.forEach((row, index) => {
    if (index < 3) {
      console.log(`Row ${index}:`, row);
    }

    const tripDate = row[tripDateIdx];
    const tripVehicleId = row[tripVehicleIdIdx];
    const tripDriverId = row[tripDriverIdIdx];
    const customerId = row[customerIdIdx];
    const puTime = row[puTimeIdx];
    const doTime = row[doTimeIdx];
    const puAddress = row[puAddressIdx];
    const doAddress = row[doAddressIdx];

    const runDate = row[runDateIdx];
    const runVehicleId = row[runVehicleIdIdx];
    const runDriverId = row[runDriverIdIdx];
    const runStartTime = row[runStartTimeIdx];
    const runEndTime = row[runEndTimeIdx];

    const rowDate = tripDate || runDate;
    const vehicleId = tripVehicleId || runVehicleId || 'Unassigned';
    const vehicleSort = `${tripVehicleId || runVehicleId ? 1 : 0}${vehicleId}`;
    const driverId = tripDriverId || runDriverId || 'Unassigned';
    const driverSort = `${tripDriverId || runDriverId ? 1 : 0}${driverId}`;

    if (!runGroups[rowDate]) runGroups[rowDate] = {
      runDate: rowDate,
      runs: {}
    }

    // Create composite key
    const runKey = `${rowDate}|${vehicleId}|${driverId}`;
    if (!runGroups[rowDate].runs[runKey]) {
      runGroups[rowDate].runs[runKey] = {
        runId: runKey,
        runDate: rowDate,
        vehicleId: vehicleId,
        vehicleSort: vehicleSort,
        driverId: driverId,
        driverSort: driverSort,
        runStartTime: formatTimeValue(runStartTime),
        runEndTime: formatTimeValue(runEndTime),
        trips: []
      };
    }

    if (tripDate) {
      runGroups[tripDate].runs[runKey].trips.push({
        tripId: customerId,
        pickupTime: formatTimeValue(puTime),
        dropoffTime: formatTimeValue(doTime),
        pickupLocation: puAddress,
        dropoffLocation: doAddress
      });
    }
  });

  console.log('Run groups created:', runGroups);

  // Convert to nested and sorted arrays
  const runDates = [];
  for (let dateKey in runGroups) {
    const dateGroup = runGroups[dateKey];

    const runs = [];
    for (let runKey in dateGroup.runs) {
      const run = dateGroup.runs[runKey];
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
      if (a.vehicleSort < b.vehicleSort) return -1;
      if (a.vehicleSort > b.vehicleSort) return 1;
      // Same vehicle, sort by driver
      if (a.driverSort < b.driverSort) return -1;
      if (a.driverSort > b.driverSort) return 1;
      return 0;
    });
    runDates.push({
      runDate: dateGroup.runDate,
      runs: runs
    });
  }
  runDates.sort((a,b) => {
    if (a.runDate < b.runDate) return -1;
    if (a.runDate > b.runDate) return 1;
    return 0;
  });

  console.log('Runs created and sorted:', runDates);

  return { runDates: runDates };
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
  svgContainer.style.width = '100%';
  svgContainer.style.height = (window.innerHeight || data.height || 400) + 'px';
  svgContainer.style.overflowY = 'auto';
  svgContainer.style.overflowX = 'auto';
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
  let tripLineWidth = 2;
  let markerSize = 4;

  try {
    if (styleConfig) {
      lineColor = styleConfig.lineColor?.value?.color || lineColor;
      pickupColor = styleConfig.pickupColor?.value?.color || pickupColor;
      dropoffColor = styleConfig.dropoffColor?.value?.color || dropoffColor;
      runFillColor = styleConfig.runFillColor?.value?.color || runFillColor;
      runBorderColor = styleConfig.runBorderColor?.value?.color || runBorderColor;
      runBorderWidth = styleConfig.runBorderWidth?.value || runBorderWidth;
      runOpacity = styleConfig.runOpacity?.value || runOpacity;
      tripLineWidth = styleConfig.tripLineWidth?.value || tripLineWidth;
      markerSize = styleConfig.markerSize?.value || markerSize;
    }
  } catch (error) {
    console.error('Error accessing style config:', error);
  }

  // Dimensions
  const margin = { top: 40, right: 60, bottom: 40, left: 120 };
  const availableWidth = window.innerWidth || 1000;
  const width = availableWidth - margin.left - margin.right;

  // Create SVG
  const svg = d3.select(svgContainer)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Parse time - handle 12-hour AM/PM format
  const parseTime = d3.timeParse('%I:%M %p');
  const formatTime = d3.timeFormat('%I:%M %p');
  const parseDate = d3.timeParse('%Y%m%d');
  const formatDate = d3.timeFormat('%A, %B %e, %Y');

  // Collect all times (trips + run schedules)
  const allTimes = [];
  data.runDates.forEach(runDate => {
    runDate.runs.forEach(run => {
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

  // Constants for run height calculation
  const lineSpacing = 10;           // Vertical spacing between trip lanes
  const runPaddingTop = 15;         // Padding above trips
  const runPaddingBottom = 15;      // Padding below trips
  const minLabelHeight = 40;        // Minimum height for vehicle/driver labels
  const runGap = 20;                // Gap between runs

  // Pre-calculate lane assignments for all runs to determine heights
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

  // Calculate positions and heights for each run based on lane count
  const runPositions = {};
  const datePositions = {};
  let currentY = 0;

  data.runDates.forEach((runDate) => {
    datePositions[runDate.runDate] = {
      y: currentY,
      height: minLabelHeight,
    };
    currentY += minLabelHeight

    runDate.runs.forEach((run, index) => {
      const runId = run.runId;
      const tripsWithLanes = assignLanes(run.trips, parseTime);

      // Determine max lane number
      const maxLane = tripsWithLanes.length > 0
        ? Math.max(...tripsWithLanes.map(t => t.lane))
        : 0;

      // Calculate height needed for trips
      const tripsHeight = maxLane * lineSpacing;

      // Total run height: padding + trips + padding, with minimum for labels
      const calculatedHeight = runPaddingTop + tripsHeight + runPaddingBottom;
      const runHeight = Math.max(calculatedHeight, minLabelHeight);

      runPositions[runId] = {
        y: currentY,
        height: runHeight,
        tripsWithLanes: tripsWithLanes,
        maxLane: maxLane
      };

      currentY += runHeight + runGap;
    });
  });

  // Calculate total height needed
  const totalHeight = currentY;

  // Update SVG height
  svg.select(function() { return this.parentNode; })
    .attr('height', totalHeight + margin.top + margin.bottom);

  // Helper functions to replace yScale
  function getDateY(runDate) {
    return datePositions[runDate].y;
  }

  function getDateHeight(runDate) {
    return datePositions[runDate].height;
  }

  function getRunY(runId) {
    return runPositions[runId].y;
  }

  function getRunHeight(runId) {
    return runPositions[runId].height;
  }

  function getRunLanes(runId) {
    return runPositions[runId].tripsWithLanes;
  }

  // Draw X axis
  const xAxis = d3.axisBottom(xScale)
    .ticks(d3.timeHour.every(1))
    .tickFormat(formatTime);

  svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${totalHeight})`)
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
      .attr('y2', totalHeight)
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');
  });

  // Draw Y axis labels manually (no scale to use)
  const yAxisGroup = svg.append('g')
    .attr('class', 'y-axis');

  data.runDates.forEach(runDate => {
    const dateYPosition = getDateY(runDate.runDate);
    const dateHeight = getDateHeight(runDate.runDate);
    const dateLabelY = dateYPosition + dateHeight - 5;
    const parsedDate = parseDate(runDate.runDate);
    const dateLabel = parsedDate ? formatDate(parsedDate) : runDate.runDate;

    const dateLabelGroup = yAxisGroup.append('g')
      .attr('transform', `translate(0, ${dateLabelY})`);
    const dateText = dateLabelGroup.append('text')
      .style('text-anchor', 'start')
      .attr('x', 0)
      .attr('dy',0)
      .style('font-size', '18px')
      .style('font-weight', '600')
      .text(dateLabel);

    runDate.runs.forEach(run => {
      const runId = run.runId;
      const runY = getRunY(runId) + (runGap / 2);
      const runHeight = getRunHeight(runId);
      const labelY = runY + runHeight / 2; // Center label vertically in run

      const labelGroup = yAxisGroup.append('g')
        .attr('transform', `translate(-10, ${labelY})`);
      const text = labelGroup.append('text')
        .style('text-anchor', 'end');

      // Vehicle ID on first line
      text.append('tspan')
        .attr('x', 0)
        .attr('dy', '-0.3em')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text(run.vehicleId);

      // Driver ID on second line
      text.append('tspan')
        .attr('x', 0)
        .attr('dy', '1.2em')
        .style('font-size', '12px')
        .style('font-weight', '400')
        .style('fill', '#666')
        .text(run.driverId);
    });
  });

  // Draw horizontal lines between runs
  data.runDates.forEach((runDate, i) => {
    runDate.runs.forEach(run => {
      const runId = run.runId;
      const yPosition = getRunY(runId);
      svg.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', yPosition)
        .attr('y2', yPosition)
        .attr('stroke', '#d1d5db')
        .attr('stroke-width', 1);
    });

    const dateYPosition = getDateY(runDate.runDate);
    const dateHeight = getDateHeight(runDate.runDate);
    if (i) { // Don't draw the top date separater line for the first date group
      svg.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', dateYPosition)
        .attr('y2', dateYPosition)
        .attr('stroke', '#000000')
        .attr('stroke-width', 3);
    }
    svg.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', dateYPosition + dateHeight)
      .attr('y2', dateYPosition + dateHeight)
      .attr('stroke', '#000000')
      .attr('stroke-width', 3);
  });

  // Draw run schedule rectangles (background)
  data.runDates.forEach(runDate => {
    runDate.runs.forEach(run => {
      const runId = run.runId;
      const runYBase = getRunY(runId) + (runGap / 2);
      const runHeight = getRunHeight(runId);

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
            .attr('height', runHeight)
            .attr('fill', runFillColor)
            .attr('stroke', runBorderColor)
            .attr('stroke-width', runBorderWidth)
            .attr('opacity', runOpacity);
        }
      }
    });
  });

  // Draw trips
  data.runDates.forEach(runDate => {
    runDate.runs.forEach(run => {
      const runId = run.runId;
      const runYBase = getRunY(runId) + (runGap / 2);
      const runHeight = getRunHeight(runId);
      const tripsWithLanes = getRunLanes(runId);

      // Calculate bundle height from lanes
      const maxLane = tripsWithLanes.length > 0
        ? Math.max(...tripsWithLanes.map(t => t.lane))
        : 0;
      const bundleHeight = maxLane * lineSpacing;

      // Center the bundle within the run
      const yOffset = runYBase + (runHeight - bundleHeight) / 2;

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
          .attr('stroke-width', tripLineWidth)
          .attr('stroke-opacity', 0.7)
          .attr('stroke-linecap', 'round')
          .style('cursor', 'pointer');

        // Hover on line
        tripLine
          .on('mouseenter', function(event) {
            d3.select(this)
              .transition()
              .duration(100)
              .attr('stroke-width', tripLineWidth + 1)
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
              .attr('stroke-width', tripLineWidth)
              .attr('stroke-opacity', 0.7);

            tooltip.style.opacity = '0';
          });

        // Pickup marker
        const pickupGroup = svg.append('g')
          .style('cursor', 'pointer');

        pickupGroup.append('circle')
          .attr('cx', x1)
          .attr('cy', yPosition)
          .attr('r', markerSize)
          .attr('fill', pickupColor)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5);

        pickupGroup
          .on('mouseenter', function(event) {
            d3.select(this).select('circle')
              .transition()
              .duration(100)
              .attr('r', markerSize + 2);

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
              .attr('r', markerSize);

            tooltip.style.opacity = '0';
          });

        // Dropoff marker
        const dropoffGroup = svg.append('g')
          .style('cursor', 'pointer');

        dropoffGroup.append('circle')
          .attr('cx', x2)
          .attr('cy', yPosition)
          .attr('r', markerSize)
          .attr('fill', dropoffColor)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5);

        dropoffGroup
          .on('mouseenter', function(event) {
            d3.select(this).select('circle')
              .transition()
              .duration(100)
              .attr('r', markerSize + 2);

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
              .attr('r', markerSize);

            tooltip.style.opacity = '0';
          });
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
