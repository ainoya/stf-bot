build:
	docker build -t quay.io/ainoya/stfbot-app .
push:
	docker push quay.io/ainoya/stfbot-app
