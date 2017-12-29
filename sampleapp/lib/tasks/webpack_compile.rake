task :webpack_compile do
  system('cd client && npm run webpack')
end

Rake::Task['assets:precompile'].enhance ['webpack_compile']
