# Be sure to restart your server when you modify this file.

# Version of your assets, change this if you want to expire all your assets.
Rails.application.config.assets.version = '1.0'

Rails.application.config.assets.js_compressor = Uglifier.new
Rails.application.config.assets.js_compressor.singleton_class.prepend(
  Module.new do
    def compress es6code
      es5code = Babel::Transpiler.transform(es6code, compact: true)['code']
      super(es5code).gsub(/\A"use strict";/, '')
    end
  end
)

# Add additional assets to the asset load path.
# Rails.application.config.assets.paths << Emoji.images_path
# Add Yarn node_modules folder to the asset load path.
Rails.application.config.assets.paths << Rails.root.join('node_modules')
Rails.application.config.assets.paths << Rails.root.join('app', 'assets', 'webpack')

# Precompile additional assets.
# application.js, application.css, and all non-JS/CSS in the app/assets
# folder are already added.
Rails.application.config.assets.precompile += %w[application_tree.js application_graph.js]
