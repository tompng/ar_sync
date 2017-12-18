Vue.filter('date', dateString => {
  const dateObject = new Date(dateString)
  const year = 1900 + dateObject.getYear()
  const month = 1 + dateObject.getMonth()
  const date = dateObject.getDate()
  const hour = dateObject.getHours()
  const min = dateObject.getMinutes()
  return `${year}/${month}/${date} ${('0'+hour).substr(-2)}:${('0'+min).substr(-2)}`
})
