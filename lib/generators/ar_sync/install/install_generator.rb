module ArSync
  class InstallGenerator < ::Rails::Generators::Base
    def create_api_controller
      create_file 'app/controllers/sync_api_controller.rb', <<~CODE
        class SyncApiController < ApplicationController
          include ArSync::ApiControllerConcern
          # serializer_field :my_data do |_user|
          #   current_user
          # end

          # serializer_field :comment do |_user, id:|
          #   Comment.where(current_user_can_access).find id
          # end
          end
        end
      CODE
    end

    def create_sync_channel
      create_file 'app/channels/sync_channel.rb', <<~CODE
        class SyncChannel < ApplicationCable::Channel
          def subscribed
            stream_from params[:key]
          end
        end
      CODE
    end

    def setup_routes
      inject_into_file(
        'config/routes.rb',
        "\n  post '/sync_api', to: 'sync_api#sync_call'" +
        "\n  post '/static_api', to: 'sync_api#static_call'" +
        "\n  post '/graphql', to: 'sync_api#graphql_call'" +
        "\n  get '/schema.graphql', to: 'sync_api#graphql_schema'",
        after: 'Rails.application.routes.draw do'
      )
    end

    def setup_js
      inject_into_file(
        'app/assets/javascripts/application.js',
        [
          '//= require ar_sync_tree',
          '//= require action_cable',
          'require ar_sync_actioncable_adapter',
          'ArSyncModel.setConnectionAdapter(new ArSyncActionCableAdapter())'
        ].join("\n") + "\n",
        before: '//= require_tree .'
      )
    end
  end
end
