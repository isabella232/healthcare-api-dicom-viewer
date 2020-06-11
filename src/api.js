import * as auth from './auth.js';

const CLOUD_RESOURCE_MANAGER_API_BASE = 'https://cloudresourcemanager.googleapis.com';
const HEALTHCARE_API_BASE = 'https://healthcare.googleapis.com';
const HEALTHCARE_BETA_API_BASE = 'https://content-healthcare.googleapis.com';

/**
 * Fetches a url using an access token, signing the user in
 * if no access token exists
 * @param {string} url The url to fetch
 * @return {Promise<Response>} Fetch response object
 */
const authenticatedFetch = async (url) => {
  const accessToken = auth.getAccessToken();
  if (accessToken) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status == 401) {
        auth.signInToGoogle();
      } else {
        throw new Error(response.json());
      }
    }

    return response;
  } else {
    auth.signInToGoogle();
  }
};

/**
 * Fetches a list of the users google cloud projects recursively
 * @param {string=} pageToken Page token to use for the request
 * @param {Array} projects Projects fetched from a previous iteration
 * @return {Array<string>} List of projects available to the user
 */
export const fetchProjects = async (pageToken, projects) => {
  const endpoint = '/v1/projects' +
      (pageToken ? `?pageToken=${pageToken}` : '');
  const response =
    await authenticatedFetch(CLOUD_RESOURCE_MANAGER_API_BASE + endpoint);
  const data = await response.json();

  // If next page token is present in the response, fetch again with
  // current project list
  if (data.nextPageToken) {
    if (projects) {
      return fetchProjects(data.nextPageToken,
          [...projects, ...data.projects]);
    }
    return fetchProjects(data.nextPageToken, data.projects);
  }

  // Return a list of project Id's
  if (projects) {
    return [...projects, ...data.projects].map((project) => project.projectId);
  }
  return data.projects.map((project) => project.projectId);
};

/**
 * Fetches a list of the possible locations for a given project
 * @param {string} projectId Project id to search locations for
 * @return {Array<string>} List of locations available for project
 */
export const fetchLocations = async (projectId) => {
  const endpoint = `/v1beta1/projects/${projectId}/locations`;
  const response =
    await authenticatedFetch(HEALTHCARE_BETA_API_BASE + endpoint);
  const data = await response.json();

  // Return a list of location Id's
  return data.locations.map((location) => location.locationId);
};

/**
 * Fetches a list of the datasets in a given project/location
 * @param {string} projectId Project id
 * @param {string} location Location
 * @return {Array<string>} List of datasets available
 */
export const fetchDatasets = async (projectId, location) => {
  const endpoint = `/v1/projects/${projectId}/locations/${location}/datasets`;
  const response =
    await authenticatedFetch(HEALTHCARE_API_BASE + endpoint);
  const data = await response.json();

  // Return a list of datasets by only using content of string after last '/'
  return data.datasets.map((dataset) => dataset.name.split('/').slice(-1)[0]);
};

/**
 * Fetches a list of the dicomStores in a given project/location/dataset
 * @param {string} projectId Project ID
 * @param {string} location Location
 * @param {string} dataset Dataset
 * @return {Array<string>} List of dicomStores available
 */
export const fetchDicomStores = async (projectId, location, dataset) => {
  const endpoint =
    `/v1/projects/${projectId}/locations/${location}/datasets/${dataset}` +
    `/dicomStores`;
  const response =
    await authenticatedFetch(HEALTHCARE_API_BASE + endpoint);
  const data = await response.json();

  // Return a list of dicomStores by only using content of string after last '/'
  return data.dicomStores.map((dicomStore) =>
    dicomStore.name.split('/').slice(-1)[0]);
};

/**
 * Fetches a list of studies in a given project/location/dataset/dicomStore
 * @param {string} projectId Project ID
 * @param {string} location Location
 * @param {string} dataset Dataset
 * @param {string} dicomStore Dicom Store
 * @return {Array<Object>} List of studies in the dicom store
 */
export const fetchStudies =
async (projectId, location, dataset, dicomStore) => {
  const endpoint =
    `/v1/projects/${projectId}/locations/${location}/datasets/${dataset}` +
    `/dicomStores/${dicomStore}/dicomWeb/studies`;
  const response =
    await authenticatedFetch(HEALTHCARE_API_BASE + endpoint);
  const data = await response.json();

  return data;
};

/**
 * Fetches a list of series in a given project/location/dataset/dicomStore/study
 * @param {string} projectId Project ID
 * @param {string} location Location
 * @param {string} dataset Dataset
 * @param {string} dicomStore Dicom Store
 * @param {string} studyId Study UID
 * @return {Array<Object>} List of series in the study
 */
export const fetchSeries =
async (projectId, location, dataset, dicomStore, studyId) => {
  const endpoint =
    `/v1/projects/${projectId}/locations/${location}/datasets/${dataset}` +
    `/dicomStores/${dicomStore}/dicomWeb/studies/${studyId}/series`;
  const response =
    await authenticatedFetch(HEALTHCARE_API_BASE + endpoint);
  const data = await response.json();

  return data;
};