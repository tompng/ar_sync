module ArSync
  class InstallGenerator < ::Rails::Generators::Base
    def create_api_controller
      create_file 'app/controllers/sync_api_controller.rb', <<~CODE
        class SyncApiController < ApplicationController
          include ARSync::ApiControllerConcern

          # api :my_data do |_params|
          #   current_user
          # end

          # api :comment do |params|
          #   Comment.where(current_user_can_access).find params[:id]
          # end
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
        "\n  post '/sync_api', to: 'sync_api#api_call'",
        after: 'Rails.application.routes.draw do'
      )
    end

    def setup_js
      inject_into_file(
        'app/assets/javascripts/application.js',
        "//= require ar_sync\n",
        before: '//= require_tree .'
      )
    end
  end
end
