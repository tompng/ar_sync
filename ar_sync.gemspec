lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'ar_sync/version'

Gem::Specification.new do |spec|
  spec.name          = 'ar_sync'
  spec.version       = ArSync::VERSION
  spec.authors       = ['tompng']
  spec.email         = ['tomoyapenguin@gmail.com']

  spec.summary       = %(ActiveRecord - JavaScript Sync)
  spec.description   = %(ActiveRecord data synchronized with frontend DataStore)
  spec.homepage      = "https://github.com/tompng/#{spec.name}"
  spec.license       = 'MIT'

  # Prevent pushing this gem to RubyGems.org. To allow pushes either set the 'allowed_push_host'
  # to allow pushing to a single host or delete this section to allow pushing to any host.
  if spec.respond_to?(:metadata)
    spec.metadata['allowed_push_host'] = "TODO: Set to 'http://mygemserver.com'"
  else
    raise 'RubyGems 2.0 or newer is required to protect against ' \
      'public gem pushes.'
  end

  spec.files = `git ls-files -z`.split("\x0").reject do |f|
    f.match(%r{^(test|spec|features|sampleapp)/})
  end
  spec.bindir = 'exe'
  spec.executables = spec.files.grep(%r{^exe/}) { |f| File.basename(f) }
  spec.require_paths = ['lib']

  spec.add_dependency 'activerecord'
  spec.add_dependency 'ar_serializer'
  %w[rake pry sqlite3].each do |gem_name|
    spec.add_development_dependency gem_name
  end
end
