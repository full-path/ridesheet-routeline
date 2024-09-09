import * as local from './localMessage.js';
import * as ut from './utils.js';
import * as d3 from 'd3';
import * as dscc from '@google/dscc';


// change this to 'true' for local development
// change this to 'false' before deploying
export const LOCAL = false;

//// Example D3 code
//const width = 600;
//const height = 600;
//const svg = d3.select("body").append("svg")
//    .attr("width", width)
//    .attr("height", height);
//
//// Example: Adding a text label
//const text = svg.append('text')
//  .attr('x', 150)
//  .attr('y', 100)
//  .text('Hello D3')
//  .style('font-size', '24px')
//  .style('fill', 'black');
//
//// Example: Adding a circle with a transition
//const circle = svg.append('circle')
//  .attr('cx', 50)
//  .attr('cy', 50)
//  .attr('r', 20)
//  .style('fill', 'blue');
//
//circle.transition()
//  .duration(2000)
//  .attr('cx', 450)
//  .style('fill', 'red');

const testData = [
	{label: "person a", times: [
		{"starting_time": 1355752800000, "ending_time": 1355759900000},
		{"starting_time": 1355767900000, "ending_time": 1355774400000}]},
	{label: "person b", times: [
		{"starting_time": 1355759910000, "ending_time": 1355761900000}]},
	{label: "person c", times: [
		{"starting_time": 1355761910000, "ending_time": 1355763910000}]}
	];

const draw = message => {
  d3.select('#error').remove();
  try {
    drawViz(message);
  } catch (err) {
    ut.onError(ut.GENERAL_ERROR);
    console.log(err);
  }
};

// renders locally
if (LOCAL) {
  draw(local.message);
} else {
  dscc.subscribeToData(draw, {transform: dscc.objectTransform});
}
