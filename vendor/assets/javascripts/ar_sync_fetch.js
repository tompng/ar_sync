function apiCall(endpoint, requests, optionalParams) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify(Object.assign({ requests }, optionalParams))
  const option = { credentials: 'include', method: 'POST', headers, body }
  return fetch(endpoint, option).then(res => res.json())
}
function fetchStaticAPI(requests, optionalParams) {
  return apiCall(fetchStaticAPI.apiEndPoint, requests, optionalParams)
}
function fetchSyncAPI(requests, optionalParams) {
  return apiCall(fetchSyncAPI.apiEndPoint, requests, optionalParams)
}
fetchStaticAPI.apiEndPoint = '/static_api'
fetchSyncAPI.apiEndPoint = '/sync_api'

try { module.exports = { fetchStaticAPI, fetchSyncAPI } } catch (e) {}
