SOURCE_URL = https://github.com/jfdelnero/HxCModPlayer/tarball/master
SOURCE_DIR = ./source
ENVIRONMENT = shell

CC=gcc
CFLAGS=-O3 -I $(SOURCE_DIR) -Wall -DEFFECTS_USAGE_STATE -DHXCMOD_MAXCHANNELS=999
EMCC=emcc
EMCC_CFLAGS=-O3 -I $(SOURCE_DIR) -Wall -DHXCMOD_MAXCHANNELS=999
EMCC_LDFLAGS_WASM=-s EXPORTED_FUNCTIONS="['_malloc','_free','_loadMod','_getNextSoundData','_unloadMod','_main']"

OUT_JS = ../hxcmod_player.js
OUT_WASM := $(OUT_JS:.js=.wasm)

.PHONY: all clean

all: $(OUT_JS)

hxcmod.o: $(SOURCE_DIR)/hxcmod.c
	$(CC) -o $@ -c $< $(CFLAGS)

hxcmod.bc: $(SOURCE_DIR)/hxcmod.c
	$(EMCC) -o $@ -c $< $(EMCC_CFLAGS)

hxcmod_player.bc: hxcmod_player.c
	$(EMCC) -o $@ -c $< $(EMCC_CFLAGS)

$(OUT_JS): hxcmod.bc hxcmod_player.bc
	$(EMCC) -o $@  $^ \
		$(EMCC_LDFLAGS_WASM) \
		-s BINARYEN=1 \
		-s BINARYEN_METHOD='native-wasm' \
		-s DYNAMIC_EXECUTION=0 \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-s FILESYSTEM=0 \
		-s MODULARIZE=1 \
		-s USE_ES6_IMPORT_META=0;

$(SOURCE_DIR)/hxcmod.c:
	mkdir -p $(SOURCE_DIR)
	curl -sL $(SOURCE_URL) | tar xz --strip 1 -C $(SOURCE_DIR)

clean:
	$(RM) -r $(SOURCE_DIR) *.bc $(OUT_JS) $(OUT_WASM)