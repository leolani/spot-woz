SHELL = /bin/bash


project_dependencies ?= $(addprefix $(project_root)/, \
		emissor \
		cltl-combot \
		cltl-requirements \
		cltl-backend \
		cltl-vad \
		cltl-asr \
		cltl-emissor-data \
		cltl-eliza \
		spot_dialogmanagement \
		spot_disambiguation_model \
		cltl-chat-ui)

git_remote ?= https://github.com/leolani

chat_bubble_version = 1.5.0
chat_bubble = https://github.com/dmitrizzle/chat-bubble/archive/refs/tags/v$(chat_bubble_version).tar.gz


include util/make/makefile.base.mk
include util/make/makefile.py.base.mk
include util/make/makefile.git.mk
include util/make/makefile.component.mk


clean: py-clean
	rm -rf src/spot_service/chatui/static/chat-bubble
	rm -rf spacy.lock

build: src/spot_service/chatui/static/chat-bubble py-install spacy.lock

spacy.lock: | venv
	source venv/bin/activate; \
	    python -m spacy download nl_core_news_lg; \
		deactivate
	touch spacy.lock

src/spot_service/chatui/static/chat-bubble:
	$(info Download $(chat_bubble))
	@mkdir src/spot_service/chatui/static/chat-bubble
	@wget -qO- $(chat_bubble) | \
	        tar -xvzf - -C src/spot_service/chatui/static/chat-bubble --strip-components 1 \
	                chat-bubble-$(chat_bubble_version)/component
