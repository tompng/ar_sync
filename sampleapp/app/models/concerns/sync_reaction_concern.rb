module SyncReactionConcern
  extend ActiveSupport::Concern

  included do
    define_preloader :reaction_summary_loader do |records|
      summaries = {}
      Reaction.where(target: records).group(:target_id, :kind).count.each do |(target_id, kind), count|
        (summaries[target_id] ||= {})[kind] = count
      end
      summaries
    end

    define_preloader :my_reaction_loader do |records, user|
      Reaction.where(user: user, target: records).index_by(&:target_id)
    end

    sync_has_many :reactions

    sync_has_data :reaction_summary, preload: :reaction_summary_loader do |preloaded|
      preloaded[id] || {}
    end

    sync_has_one :my_reaction, preload: :my_reaction_loader do |preloaded|
      preloaded[id]
    end
  end
end
