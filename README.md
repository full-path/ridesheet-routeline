# ridesheet-routeline
A visualization of vehicle schedules designed for Looker Studio using the Community Visualizations interface.

## To build index.js for distribution and upload
```
cat lib/dscc.min.js lib/d3.min.js src/source.js > dist/index.js
gsutil cp dist/index.js gs://my-gcs-folder/
```
