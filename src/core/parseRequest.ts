export function parseRequest(request, attrsonly?){
  const query = {}
  let field = null
  let params = null
  if (!request) request = []
  if (request.constructor !== Array) request = [request]
  for (const arg of request) {
    if (typeof(arg) === 'string') {
      query[arg] = {}
    } else if (typeof(arg) === 'object') {
      for (const key in arg){
        const value = arg[key]
        if (attrsonly) {
          query[key] = parseRequest(value)
          continue
        }
        if (key === 'query') {
          const child = parseRequest(value, true)
          for (const k in child) query[k] = child[k]
        } else if (key === 'field') {
          field = value
        } else if (key === 'params') {
          params = value
        } else {
          query[key] = parseRequest(value)
        }
      }
    }
  }
  if (attrsonly) return query
  return { query, field, params }
}
