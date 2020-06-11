import React, {useState, useEffect} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Typography, Breadcrumbs, Link, Box} from '@material-ui/core';
import * as auth from '../auth.js';
import * as api from '../api.js';
import SearchList from './searchlist.js';
import Viewer from './viewer.js';


const useStyles = makeStyles((theme) => ({
  root: {
    background: '#fff',
  },
}));

/**
 * Main page for the app
 * @return {ReactElement} <Main />
 */
export default function Main() {
  const classes = useStyles();

  // Declare state variables
  const [, setIsSignedIn] = useState(false);

  // Project state
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Location state
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Dataset state
  const [datasets, setDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);

  // DicomStore state
  const [dicomStores, setDicomStores] = useState([]);
  const [dicomStoresLoading, setDicomStoresLoading] = useState(false);
  const [selectedDicomStore, setSelectedDicomStore] = useState(null);

  // Study state
  const [studies, setStudies] = useState([]);
  const [studiesLoading, setStudiesLoading] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState(null);

  // Series state
  const [series, setSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState(null);

  /* On mount, check if user is signed in already or not
  by checking for an access token in local storage */
  useEffect(() => {
    const signedIn = Boolean(auth.getAccessToken());
    setIsSignedIn(signedIn);

    if (signedIn) {
      loadProjects();
    } else {
      signIn();
    }
  }, []);

  const signIn = () => {
    auth.signInToGoogle();
  };

  // Generic flow for populating data into our react component
  const loadData = async (apiCall, setLoading, setData) => {
    setLoading(true);
    try {
      const data = await apiCall();
      setData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Use loadData to generate functions for loading all state data
  const loadProjects = async () =>
    loadData(api.fetchProjects, setProjectsLoading, setProjects);

  const loadLocations = async (projectId) =>
    loadData(() => api.fetchLocations(projectId),
        setLocationsLoading, setLocations);

  const loadDatasets = async (projectId, location) =>
    loadData(() => api.fetchDatasets(projectId, location),
        setDatasetsLoading, setDatasets);

  const loadDicomStores = async (projectId, location, dataset) =>
    loadData(() => api.fetchDicomStores(projectId, location, dataset),
        setDicomStoresLoading, setDicomStores);

  const loadStudies = async (projectId, location, dataset, dicomStore) =>
    loadData(async () => {
      const data = await api.fetchStudies(projectId, location,
          dataset, dicomStore);

      // Add a new field "displayValue" to each study for the SearchList
      return data.map((study) => ({...study,
        displayValue: study['00100010'].Value[0].Alphabetic}));
    }, setStudiesLoading, setStudies);

  const loadSeries =
  async (projectId, location, dataset, dicomStore, studyId) =>
    loadData(async () => {
      const data = await api.fetchSeries(projectId, location,
          dataset, dicomStore, studyId);

      // Add a new field "displayValue" to each series for the SearchList
      return data.map((series) => ({...series,
        displayValue: series['0008103E'].Value[0]}));
    }, setSeriesLoading, setSeries);

  const selectProject = (projectId) => {
    setSelectedProject(projectId);
    loadLocations(projectId);
  };

  const selectLocation = (locationId) => {
    setSelectedLocation(locationId);
    loadDatasets(selectedProject, locationId);
  };

  const selectDataset = (dataset) => {
    setSelectedDataset(dataset);
    loadDicomStores(selectedProject, selectedLocation, dataset);
  };

  const selectDicomStore = (dicomStore) => {
    setSelectedDicomStore(dicomStore);
    loadStudies(selectedProject, selectedLocation, selectedDataset, dicomStore);
  };

  const selectStudy = (study) => {
    setSelectedStudy(study);

    loadSeries(selectedProject, selectedLocation, selectedDataset,
        selectedDicomStore, study['0020000D'].Value[0]);
  };

  const selectSeries = (series) => {
    setSelectedSeries(series);
  };

  const clearProject = () => {
    setSelectedProject(null);

    setSelectedLocation(null);
    setLocations([]);

    setSelectedDataset(null);
    setDatasets([]);

    setSelectedDicomStore(null);
    setDicomStores([]);

    setSelectedStudy(null);
    setStudies([]);

    setSelectedSeries(null);
    setSeries([]);

    loadProjects();
  };

  const clearLocation = () => {
    setSelectedLocation(null);

    setSelectedDataset(null);
    setDatasets([]);

    setSelectedDicomStore(null);
    setDicomStores([]);

    setSelectedStudy(null);
    setStudies([]);

    setSelectedSeries(null);
    setSeries([]);

    loadLocations(selectedProject);
  };

  const clearDataset = () => {
    setSelectedDataset(null);

    setSelectedDicomStore(null);
    setDicomStores([]);

    setSelectedStudy(null);
    setStudies([]);

    setSelectedSeries(null);
    setSeries([]);

    loadDatasets(selectedProject, selectedLocation);
  };

  const clearDicomStore = () => {
    setSelectedDicomStore(null);

    setSelectedStudy(null);
    setStudies([]);

    setSelectedSeries(null);
    setSeries([]);

    loadDicomStores(selectedProject, selectedLocation, selectedDataset);
  };

  const clearStudy = () => {
    setSelectedStudy(null);

    setSelectedSeries(null);
    setSeries([]);

    loadStudies(selectedProject, selectedLocation,
        selectedDataset, selectedDicomStore);
  };

  const clearSeries = () => {
    setSelectedSeries(null);
    loadSeries(selectedProject, selectedLocation,
        selectedDataset, selectedDicomStore,
        selectedStudy['0020000D'].Value[0]);
  };

  return (
    <div className={classes.root}>
      <Box m={2} display="flex" flexDirection="row">
        <Box flexGrow={1}>
          <Breadcrumbs>
            {selectedProject ?
              <Link color="inherit" href="#" onClick={clearProject}>
                {selectedProject}
              </Link> :
              <Typography color="textPrimary">
                Select Project
              </Typography>}
            {selectedLocation ?
              <Link color="inherit" href="#" onClick={clearLocation}>
                {selectedLocation}
              </Link> :
              selectedProject ?
                <Typography color="textPrimary">
                  Select Location
                </Typography> : null}
            {selectedDataset ?
              <Link color="inherit" href="#" onClick={clearDataset}>
                {selectedDataset}
              </Link> :
              selectedLocation ?
                <Typography color="textPrimary">
                  Select Dataset
                </Typography> : null}
            {selectedDicomStore ?
              <Link color="inherit" href="#" onClick={clearDicomStore}>
                {selectedDicomStore}
              </Link> :
              selectedDataset ?
                <Typography color="textPrimary">
                  Select Dicom Store
                </Typography> : null}
            {selectedStudy ?
              <Link color="inherit" href="#" onClick={clearStudy}>
                {selectedStudy.displayValue}
              </Link> :
              selectedDicomStore ?
                <Typography color="textPrimary">
                  Select Study
                </Typography> : null}
            {selectedSeries ?
              <Link color="inherit" href="#" onClick={clearSeries}>
                {selectedSeries.displayValue}
              </Link> :
              selectedStudy ?
                <Typography color="textPrimary">
                  Select Series
                </Typography> : null}
          </Breadcrumbs>
        </Box>
        {/* <Box>
          {auth.getAccessToken() ?
              <Button variant="contained" color="primary" onClick={signOut}>
                Logout
              </Button> :
              <Button variant="contained" color="primary" onClick={signIn}>
                Login to Google
              </Button>}
        </Box> */}
      </Box>

      {!selectedProject ?
        <SearchList
          items={projects}
          onClickItem={selectProject}
          isLoading={projectsLoading} /> : null}
      {(selectedProject && !selectedLocation) ?
        <SearchList
          items={locations}
          onClickItem={selectLocation}
          isLoading={locationsLoading} /> : null}
      {(selectedLocation && !selectedDataset) ?
        <SearchList
          items={datasets}
          onClickItem={selectDataset}
          isLoading={datasetsLoading} /> : null}
      {(selectedDataset && !selectedDicomStore) ?
        <SearchList
          items={dicomStores}
          onClickItem={selectDicomStore}
          isLoading={dicomStoresLoading} /> : null}
      {(selectedDicomStore && !selectedStudy) ?
        <SearchList
          items={studies}
          onClickItem={selectStudy}
          isLoading={studiesLoading} /> : null}
      {(selectedStudy && !selectedSeries) ?
        <SearchList
          items={series}
          onClickItem={selectSeries}
          isLoading={seriesLoading} /> : null}
      {selectedSeries ?
        <Viewer
          project={selectedProject}
          location={selectedLocation}
          dataset={selectedDataset}
          dicomStore={selectedDicomStore}
          study={selectedStudy}
          series={selectedSeries} /> : null}
    </div >
  );
}