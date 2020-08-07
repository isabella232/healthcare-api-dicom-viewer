import React from 'react';
import PropTypes from 'prop-types';
import {
  Box, LinearProgress, Typography,
  TextField, Button, Checkbox,
  FormControlLabel,
} from '@material-ui/core';
import * as cornerstone from 'cornerstone-core';
import * as api from '../api.js';
import {DICOM_TAGS} from '../dicomValues.js';
import DicomImageSequencer from '../dicomImageSequencer.js';
import * as dicomImageLoader from '../dicomImageLoader/dicomImageLoader.js';

/**
 * React Component for viewing medical images
 */
export default class Viewer extends React.Component {
  /**
   * Creates a new instance of Viewer component
   * @param {Object} props React props for this component
   * @param {string} props.project Project
   * @param {string} props.location Location
   * @param {string} props.dataset Dataset
   * @param {string} props.dicomStore Dicom Store
   * @param {Object} props.study Study
   * @param {Object} props.series Series
   */
  constructor(props) {
    super(props);
    this.state = {
      instances: [],
      numReadyImages: 0,
      readyImagesProgress: 0,
      numRenderedImages: 0,
      renderedImagesProgress: 0,
      renderTimer: 0,
      fetchTimer: 0,
      totalTimer: 0,
      timeToFirstImage: 0,
      maxSimultaneousRequests: 20,
      useWebworkersToFetch: true,
      useWebworkersToParse: true,
      isDisplaying: false,
    };

    this.dicomSequencer = new DicomImageSequencer(
        this.props.project,
        this.props.location,
        this.props.dataset,
        this.props.dicomStore,
        this.props.study,
        this.props.series,
    );

    this.readyImages = [];
    this.readyImagesCount = 0;
    this.newSequence = false;
    this.fetchStartTime = 0;
    this.renderStartTime = 0,
    this.canvasElement;
    this.renderedImagesCount = 0;
    this.metricsIntervalId = 0;
  }

  /**
   * Set up cornerstone listeners and retrieve instance list on mount
   */
  componentDidMount() {
    cornerstone.enable(this.canvasElement);
    this.canvasElement.addEventListener('cornerstoneimagerendered',
        () => this.onImageRendered());
    this.getInstances();
    dicomImageLoader.configure({
      useWebworkersToFetch: this.state.useWebworkersToFetch,
      useWebworkersToParse: this.state.useWebworkersToParse,
    });
  }

  /**
   * Cancel ongoing fetches to avoid state change after unmount
   */
  componentWillUnmount() {
    this.getInstancesPromise.cancel();
  }

  /**
   * Runs when a new image is ready from the DicomImageSequencer
   * @param {Object} image Cornerstone image
   */
  onImageReady(image) {
    this.readyImages.push(image);
    this.readyImagesCount++;

    if (this.newSequence) {
      // If this is the first image in the sequence, render immediately
      this.displayNextImage();
      this.newSequence = false;
    }
  }

  /**
   * Runs when an image has been rendered to the cornerstone canvas
   */
  onImageRendered() {
    this.renderedImagesCount++;
    if (this.renderedImagesCount == 1) {
      this.renderStartTime = Date.now();
      this.setState({
        timeToFirstImage: Date.now() - this.fetchStartTime,
      });
    } else if (this.renderedImagesCount == this.state.instances.length) {
      // When last image is rendered, stop the
      // metrics interval and run one final time
      clearInterval(this.metricsIntervalId);
      this.updateMetrics();

      this.setState({
        isDisplaying: false,
      });
    }
    this.displayNextImage();
  }

  /**
   * Checks the queue of ready images and displays the next one if available
   */
  displayNextImage() {
    if (this.readyImages.length > 0) {
      const image = this.readyImages.shift();
      cornerstone.displayImage(this.canvasElement, image);
    } else {
      this.newSequence = true;
    }
  }

  /**
   * Updates the UI metrics for the currently running sequence
   */
  updateMetrics() {
    // Update progress bar
    this.setState({
      readyImagesProgress: this.readyImagesCount /
                              this.state.instances.length * 100,
      numReadyImages: this.readyImagesCount,
      renderedImagesProgress: this.renderedImagesCount /
                              this.state.instances.length * 100,
      renderTimer: Date.now() - this.renderStartTime,
      totalTimer: Date.now() - this.fetchStartTime,
      numRenderedImages: this.renderedImagesCount,
    });
  }

  /**
   * Resets variables and begins fetching dicom images in sequence
   */
  startDisplayingInstances() {
    this.newSequence = true;
    this.renderedImagesCount = 0;
    this.readyImages = [];
    this.readyImagesCount = 0;
    this.fetchStartTime = Date.now();
    this.setState({
      renderTimer: 0,
      totalTimer: 0,
      fetchTimer: 0,
      numReadyImages: 0,
      readyImagesProgress: 0,
      numRenderedImages: 0,
      renderedImagesProgress: 0,
      timeToFirstImage: 0,
      isDisplaying: true,
    });

    // Purge cornerstone cache
    cornerstone.imageCache.purgeCache();

    this.dicomSequencer.maxSimultaneousRequests =
        this.state.maxSimultaneousRequests;
    this.dicomSequencer.setInstances(this.state.instances);
    this.dicomSequencer.fetchInstances((image) => this.onImageReady(image));

    // Set up an interval for updating metrics (20 times per second)
    this.metricsIntervalId = setInterval(() => this.updateMetrics(), 50);
  }

  /**
   * Retrieves a list of dicom instances in this series
   */
  getInstances() {
    this.getInstancesPromise = api.makeCancelable(
        api.fetchMetadata(
            this.props.project, this.props.location,
            this.props.dataset, this.props.dicomStore,
            this.props.study[DICOM_TAGS.STUDY_UID].Value[0],
            this.props.series[DICOM_TAGS.SERIES_UID].Value[0],
        ),
    );

    this.getInstancesPromise.promise
        .then((instances) => {
          this.setState({
            instances,
          });
        })
        .catch((reason) => {
          if (!reason.isCanceled) {
            console.error(reason);
          }
        });
  }

  /**
   * Fired when checkbox is changed for using fetch webworkers
   * @param {React.ChangeEvent<HTMLInputElement>} event Event object
   */
  handleWebworkerFetchChecked(event) {
    this.setState({
      useWebworkersToFetch: event.target.checked,
    });

    dicomImageLoader.configure({
      useWebworkersToFetch: event.target.checked,
      useWebworkersToParse: this.state.useWebworkersToParse,
    });
  }

  /**
   * Fired when checkbox is changed for using parse webworkers
   * @param {React.ChangeEvent<HTMLInputElement>} event Event object
   */
  handleWebworkerParseChecked(event) {
    this.setState({
      useWebworkersToParse: event.target.checked,
    });

    dicomImageLoader.configure({
      useWebworkersToParse: event.target.checked,
      useWebworkersToFetch: this.state.useWebworkersToFetch,
    });
  }

  /**
   * Renders the component
   * @return {ReactComponent} <Viewer/>
   */
  render() {
    return (
      <Box p={2} display="flex" flexWrap="wrap">
        <Box mr={2}>
          <div id="cornerstone-div"
            ref={(input) => {
              this.canvasElement = input;
            }}
            style={{
              width: 500,
              height: 500,
              background: 'black',
            }}
          >
            <canvas className="cornerstone-canvas"></canvas>
          </div>
          <LinearProgress variant="buffer"
            value={this.state.renderedImagesProgress}
            valueBuffer={this.state.readyImagesProgress} /><br/>
          <TextField
            label="Max Simultaneous Requests"
            style={{width: 250}}
            defaultValue={this.state.maxSimultaneousRequests}
            onChange={(e) => {
              this.setState({maxSimultaneousRequests: Number(e.target.value)});
            }} /><br/>
          <FormControlLabel
            control={
              <Checkbox
                checked={this.state.useWebworkersToFetch}
                onChange={(e) => this.handleWebworkerFetchChecked(e)}
                color="primary"
              />
            }
            label="Use Webworkers to Fetch"
          /><br/>
          <FormControlLabel
            control={
              <Checkbox
                checked={this.state.useWebworkersToParse}
                onChange={(e) => this.handleWebworkerParseChecked(e)}
                color="primary"
              />
            }
            label="Use Webworkers to Parse"
          /><br/>
          <Button
            variant="contained"
            color="primary"
            disabled={this.state.instances.length == 0 ||
                this.state.isDisplaying}
            onClick={() => this.startDisplayingInstances()}>
              Start
          </Button>
        </Box>
        <Box>
          <Typography variant="h5">
            Frames Loaded: {this.state.numReadyImages}
          </Typography>
          <Typography variant="h5">
            Frames Displayed: {this.state.numRenderedImages}
          </Typography>
          <Typography variant="h5">
            Total Time: {(this.state.totalTimer / 1000).toFixed(2)}s
          </Typography>
          <Typography variant="h5">
            Time to First Image: {
              (this.state.timeToFirstImage / 1000).toFixed(2)
            }s
          </Typography>
          <Typography variant="h5">
            Average FPS: {(this.state.numRenderedImages /
                        (this.state.renderTimer / 1000)).toFixed(2)}
          </Typography>
        </Box>
      </Box>
    );
  }
}
Viewer.propTypes = {
  project: PropTypes.string.isRequired,
  location: PropTypes.string.isRequired,
  dataset: PropTypes.string.isRequired,
  dicomStore: PropTypes.string.isRequired,
  study: PropTypes.object.isRequired,
  series: PropTypes.object.isRequired,
};
