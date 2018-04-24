function fetchSyncAPI(requests, optionalParams) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify(Object.assign({ requests }, optionalParams))
  const option = { credentials: 'include', method: 'POST', headers, body }
  return fetch(fetchSyncAPI.apiEndPoint, option).then(res => res.json())
}
fetchSyncAPI.apiEndPoint = '/sync_api'

try { module.exports = fetchSyncAPI } catch (e) {}
