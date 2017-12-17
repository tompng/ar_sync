srand 0
users = (1..8).map { |i| User.create name: "user#{i}" }
posts = (1..16).map do |i|
  Post.create(
    user: users.sample,
    title: "Title #{i+1}",
    body: "Body #{i}. " * rand(4..10)
  )
end
comments = (1..32).map do |i|
  posts.sample.comments.create(
    user: users.sample,
    body: "Comment #{i}" * rand(1..4)
  )
end
(posts + comments).each do |record|
  users.sample(rand * users.size).each do |user|
    record.reactions.create kind: Reaction::Kinds.sample, user: user
  end
end
users.each do |user|
  (users - [user]).sample(rand(users.size)).each do |target_user|
    user.followings.create to: target_user
  end
end
