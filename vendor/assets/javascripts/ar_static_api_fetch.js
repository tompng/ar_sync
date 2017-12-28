function fetchStaticAPI(requests, optionalParams) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify(Object.assign({ requests }, optionalParams))
  const option = { credentials: 'include', method: 'POST', headers, body }
  return fetch('/static_api', option).then(res => res.json())
}

try { module.exports = fetchStaticAPI } catch (e) {}
