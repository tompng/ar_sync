class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true
end
ArSync.use :tree, klass: ApplicationRecord
