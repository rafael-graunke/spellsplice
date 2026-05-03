# [0.7.0-rc.2](https://github.com/rafael-graunke/spellsplice/compare/v0.7.0-rc.1...v0.7.0-rc.2) (2026-05-03)


### Bug Fixes

* **assets:** move static SVGs into public/assets/ ([3635d32](https://github.com/rafael-graunke/spellsplice/commit/3635d3231109c0430fac2736ee81d7eed1b21230))
* **export:** replace decoder.flush() with reset() to fix Windows hang ([2b19e62](https://github.com/rafael-graunke/spellsplice/commit/2b19e62be0f3510c73d98aaf2191862c3b81e124))
* **export:** use AVCC format for AVC encoder output ([f86a26f](https://github.com/rafael-graunke/spellsplice/commit/f86a26f373788ff0f146faae6c948cf2c40911fb))
* **export:** use H.264 High L4.2 for codec detection ([c751ed4](https://github.com/rafael-graunke/spellsplice/commit/c751ed4ddc0c552595667083ec3eaa5cf18ec490))
* **export:** use realtime latency mode to prevent encoder stall ([bb3d529](https://github.com/rafael-graunke/spellsplice/commit/bb3d52988da706ea0f5cee102a6a7cd8fc94f2fd))


### Performance Improvements

* **export:** raise bitrate to 20 Mbps, keyframe interval to 10s ([ddbd3e4](https://github.com/rafael-graunke/spellsplice/commit/ddbd3e43ba018471fe5de25ebd34dc0573ad4f13))

# [0.7.0-rc.1](https://github.com/rafael-graunke/spellsplice/compare/v0.6.0...v0.7.0-rc.1) (2026-05-01)


### Bug Fixes

* **export:** add Opus audio to WebM export ([e8f96fd](https://github.com/rafael-graunke/spellsplice/commit/e8f96fd6ec6647b6a2a55dcc670fb70aca781e7b))
* **timeline,inspector:** sticky ruler, cursor fixes, card/hand UX ([b4fccd7](https://github.com/rafael-graunke/spellsplice/commit/b4fccd7b67e8f109c86c98df29646d894f2915e1))
* **timeline:** clip cursor overflow to prevent phantom scrollbar ([bb565a3](https://github.com/rafael-graunke/spellsplice/commit/bb565a371541a53f3fa54e23bf0f95425d02df5d))
* **timeline:** time seek bugged ([4f630ac](https://github.com/rafael-graunke/spellsplice/commit/4f630ac755120f1ec19d20313284c8b3eaeb5e65))


### Features

* adds decklist import and user info editing ([de96727](https://github.com/rafael-graunke/spellsplice/commit/de9672724f55e1735e6ed898a233396806582d5f))
* **export:** add in-browser video export with overlay baking ([3b64064](https://github.com/rafael-graunke/spellsplice/commit/3b640646024b8ffc0d9c04500e149b8ff6b1ae78))
* **export:** WIP in-browser video export with overlay baking ([74dbf51](https://github.com/rafael-graunke/spellsplice/commit/74dbf5139136de2bb45b00fd1f4585424338163b))
* **export:** WIP replace ffmpeg with mp4-muxer + mp4box audio passthrough ([ebe34c9](https://github.com/rafael-graunke/spellsplice/commit/ebe34c973038f19361d36140c431c1e0a1b1cad6))


### Performance Improvements

* **preview:** switch to WebGL compositor + requestVideoFrameCallback ([e2edb82](https://github.com/rafael-graunke/spellsplice/commit/e2edb82c09f3256b76f7f63781e77efa2f2e7264))
* **timeline:** drive cursor via rAF + imperative ref ([166f72e](https://github.com/rafael-graunke/spellsplice/commit/166f72eeecb585f12e6545143d5e6ad2315396c3))

# [0.6.0](https://github.com/rafael-graunke/spellsplice/compare/v0.5.3...v0.6.0) (2026-04-26)


### Features

* **caching:** persist players and card cache to localStorage ([d224da7](https://github.com/rafael-graunke/spellsplice/commit/d224da7d77f02e68484f6671a800e3735c1ebd0e))

## [0.5.3](https://github.com/rafael-graunke/spellsplice/compare/v0.5.2...v0.5.3) (2026-04-24)


### Bug Fixes

* **caching:** save all cache to project file ([a38c485](https://github.com/rafael-graunke/spellsplice/commit/a38c485c3163b62938f203c7a67ae4f8d1dcca62))

## [0.5.2](https://github.com/rafael-graunke/spellsplice/compare/v0.5.1...v0.5.2) (2026-04-23)


### Bug Fixes

* **preview:** player boxes placement ([552679e](https://github.com/rafael-graunke/spellsplice/commit/552679eeba47ae29bca181b66e14cf545ed63e5d))

## [0.5.1](https://github.com/rafael-graunke/spellsplice/compare/v0.5.0...v0.5.1) (2026-04-23)


### Bug Fixes

* **preview:** fix flip card ([8ed35b2](https://github.com/rafael-graunke/spellsplice/commit/8ed35b2c1caf5776d4b7f8497f500df2cfb05565))

# [0.5.0](https://github.com/rafael-graunke/spellsplice/compare/v0.4.0...v0.5.0) (2026-04-22)


### Features

* added project export ([4568303](https://github.com/rafael-graunke/spellsplice/commit/456830303b43ac8748b5fc27a32dad337c6e1380))

# [0.4.0](https://github.com/rafael-graunke/spellsplice/compare/v0.3.0...v0.4.0) (2026-04-22)


### Bug Fixes

* **inspector:** added missing type prompt ([74450e1](https://github.com/rafael-graunke/spellsplice/commit/74450e17903a504396171d1d0e0caa951da0c7d7))
* **inspector:** amount field ([6c2df8d](https://github.com/rafael-graunke/spellsplice/commit/6c2df8df1660ba6dc8343f7e43ff8bd22fe72c9f))


### Features

* **inspector:** changes inspector style; adds printing selection ([589a632](https://github.com/rafael-graunke/spellsplice/commit/589a632914ca37d224f70b0c0dfa11cea047d9fa))

# [0.3.0](https://github.com/rafael-graunke/spellsplice/compare/v0.2.0...v0.3.0) (2026-04-21)


### Features

* **preview:** add card reveal icon ([7025d02](https://github.com/rafael-graunke/spellsplice/commit/7025d025252925d2ffcbd01935f213cca106fe63))

# [0.2.0](https://github.com/rafael-graunke/spellsplice/compare/v0.1.0...v0.2.0) (2026-04-21)


### Features

* **preview:** added cards in hand display ([34d500a](https://github.com/rafael-graunke/spellsplice/commit/34d500aaf2397263081146a2b2a9856178246f3b))

# [0.1.0](https://github.com/rafael-graunke/spellsplice/compare/v0.0.0...v0.1.0) (2026-04-21)


### Features

* **preview:** add card display render ([29d2670](https://github.com/rafael-graunke/spellsplice/commit/29d2670e8a19090a7bb5b1a20205d1c8e9a1868d))
