module.exports = {
  entry: { app: './src/index.js' },
  output: {
    path: __dirname + '/../app/assets/webpack/',
    filename: 'webpack-bundle.js'
  },
  module: {
    loaders: [
      {
        test: /\.(js|jsx)$/,
        loader: "babel-loader",
        exclude: /node_modules/,
        query: { presets: ["es2015", "react"] }
      }
    ]
  },
}
