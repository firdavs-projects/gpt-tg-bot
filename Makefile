build:
	docker build -t botgpt .

run:
	docker run -d -p 3000:3000 --name botgpt --rm botgpt
