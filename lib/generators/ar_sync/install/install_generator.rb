module ArSync
  class InstallGenerator < ::Rails::Generators::Base
    def create_schema_class
      create_file 'app/models/sync_schema.rb', <<~CODE
        class SyncSchema < ArSync::SyncSchemaBase
          # serializer_field :profile, type: User do |current_user|
          #   current_user
          # end

          # serializer_field :post, type: Post do |current_user, id:|
          #   Post.where(current_user_can_access).find_by id: id
          # end

          # Reload API for all types should be defined here.

          # serializer_field :User do |current_user, ids:|
          #   User.where(current_user_can_access).where id: ids
          # end

          # serializer_field :Post do |current_user, ids:|
          #   Post.where(current_user_can_access).where id: ids
          # end

          # serializer_field :Comment do |current_user, ids:|
          #   Comment.where(current_user_can_access).where id: ids
          # end
        end
      CODE
    end

    def create_api_controller
      create_file 'app/controllers/sync_api_controller.rb', <<~CODE
        class SyncApiController < ApplicationController
          include ArSync::ApiControllerConcern
          def schema
            SyncSchema.new
          end
        end
      CODE
    end

    def create_config
      create_file 'config/initializers/ar_sync.rb', <<~CODE
        ActiveRecord::Base.include ArSync::ModelBase
        ArSync.configure do |config|
          config.current_user_method = :current_user
          config.key_prefix = 'ar_sync_'
          config.key_secret = '#{SecureRandom.hex}'
          config.key_expires_in = 30.seconds
        end
      CODE
    end

    def create_sync_channel
      create_file 'app/channels/sync_channel.rb', <<~CODE
        class SyncChannel < ApplicationCable::Channel
          def subscribed
            key = ArSync.validate_expiration params[:key]
            stream_from key if key
          end
        end
      CODE
    end

    def setup_routes
      inject_into_file(
        'config/routes.rb',
        "\n  post '/sync_api', to: 'sync_api#sync_call'" +
        "\n  post '/static_api', to: 'sync_api#static_call'" +
        "\n  post '/graphql', to: 'sync_api#graphql_call'",
        after: 'Rails.application.routes.draw do'
      )
    end

    def setup_js
      inject_into_file(
        'app/assets/javascripts/application.js',
        [
          '//= require ar_sync',
          '//= require action_cable',
          '//= require ar_sync_actioncable_adapter',
          'ArSyncModel.setConnectionAdapter(new ArSyncActionCableAdapter())'
        ].join("\n") + "\n",
        before: '//= require_tree .'
      )
    end
  end
end
