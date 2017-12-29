function fetchStaticAPI(requests, optionalParams) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify(Object.assign({ requests }, optionalParams))
  const option = { credentials: 'include', method: 'POST', headers, body }
  return fetch(fetchStaticAPI.apiEndPoint, option).then(res => res.json())
}
fetchStaticAPI.apiEndPoint = '/static_api'

try { module.exports = fetchStaticAPI } catch (e) {}
