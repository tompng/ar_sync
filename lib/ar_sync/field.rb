class ArSync::Field
  attr_reader :name
  def initialize(name)
    @name = name
  end

  def skip_propagation?(_parent, _child, _path)
    false
  end

  def action_convert(action)
    action
  end

  def order_param; end
end

class ArSync::DataField < ArSync::Field
  def type
    :data
  end

  def data(parent, _child, to_user:, **)
    ArSync.serialize parent, name, user: to_user
  end

  def path(_child)
    []
  end

  def action_convert(_action)
    :update
  end

  def skip_propagation?(_parent, _child, path)
    !path.nil?
  end
end

class ArSync::HasOneField < ArSync::Field
  def type
    :one
  end

  def data(_parent, child, action:, **)
    child._sync_data new_record: action == :create
  end

  def path(_child)
    [name]
  end
end

class ArSync::HasManyField < ArSync::Field
  attr_reader :limit, :order, :association, :propagate_when
  def type
    :many
  end

  def initialize(name, association: nil, limit: nil, order: nil, propagate_when: nil)
    super name
    @limit = limit
    @order = order
    @association = association || name
    @propagate_when = propagate_when
  end

  def skip_propagation?(parent, child, _path)
    return false unless limit
    return !propagate_when.call(child) if propagate_when
    ids = parent.send(association).order(id: order).limit(limit).ids
    if child.destroyed?
      ids.size == limit && (order == :asc ? ids.max < child.id : child.id < ids.min)
    else
      !ids.include? child.id
    end
  end

  def data(_parent, child, action:, **)
    child._sync_data new_record: action == :create
  end

  def order_param
    { limit: limit, order: order } if order
  end

  def path(child)
    [name, child.id]
  end
end

class ArSync::CollectionField < ArSync::HasManyField
  def path(child)
    [child.id]
  end
end
