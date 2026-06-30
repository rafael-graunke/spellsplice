# [0.9.0](https://github.com/rafael-graunke/spellsplice/compare/v0.8.0...v0.9.0) (2026-06-30)


### Bug Fixes

* **export:** fix animation frame duplication and broken exit animations ([9ad7165](https://github.com/rafael-graunke/spellsplice/commit/9ad7165cbc2c0341e2a6fd96f58d340d2d1c01a9))
* **export:** include HIDE_UI/SHOW_UI in overlay animation guard ([48f3565](https://github.com/rafael-graunke/spellsplice/commit/48f3565b11d7d5207c69c46b16e7e36c90d1c575))
* **export:** pass overlayStartHidden to video export pipeline ([82619e5](https://github.com/rafael-graunke/spellsplice/commit/82619e591c57228ed337801b4b55d4557df6eea8))
* **inspector:** restore autofocus on event creation from command palette ([cb380d3](https://github.com/rafael-graunke/spellsplice/commit/cb380d3b0d080bf7263a7bd1c748a472616edb73))
* **nle:** enable cross-player event drag ([001e782](https://github.com/rafael-graunke/spellsplice/commit/001e7820777e3de728ef2856f6eb5d361a85d2c8))
* **nle:** fix cross-group drag companion placement ([7de38c7](https://github.com/rafael-graunke/spellsplice/commit/7de38c76c56bc4fdba3435ea9e3b67e71b4494b0))
* **nle:** fix multi-select, delete, copy, undo bugs and remove dead code ([36cf6fe](https://github.com/rafael-graunke/spellsplice/commit/36cf6fe79d96e72894798f36daf7ba5a25c5fea2))
* **nle:** persist clips/overrides, clamp drags, fix audio sync on seek ([83ba9f2](https://github.com/rafael-graunke/spellsplice/commit/83ba9f2f3fd2e01caa4e80efb9e1f25ce4890d05))
* **nle:** require mouse movement before activating event drag ([8e9dabc](https://github.com/rafael-graunke/spellsplice/commit/8e9dabc5018e60707290bb44d4ab8f1ac6b6432c))
* **nle:** resolve inspector using wrong player after cross-player drag ([85377af](https://github.com/rafael-graunke/spellsplice/commit/85377af54d4dd5e57ab10cc931e132776fddf48b))
* **renders:** tune crop constants and hand stack bottom margin ([26b29c7](https://github.com/rafael-graunke/spellsplice/commit/26b29c74b2de44d6b2c2be9a751929bf46776f33))
* **timeline:** add horizontal edge scroll and fix time delta during scroll ([572493e](https://github.com/rafael-graunke/spellsplice/commit/572493eecfa329487394c0201fb69ab8014765a5))
* **timeline:** replace background-attachment:local with scroll-synced backgroundPositionY ([b76a23c](https://github.com/rafael-graunke/spellsplice/commit/b76a23cc5a24ab4273445f53f3ddc8fe71e9e4b1))


### Features

* add error boundary with crash screen and issue report link ([fff3fbe](https://github.com/rafael-graunke/spellsplice/commit/fff3fbe2e4c9146c1f088c59d8820187c7e0546b))
* **appbar:** show app version in top bar ([fc1c411](https://github.com/rafael-graunke/spellsplice/commit/fc1c411f3c69ea36602a8b2e33a8643a77448299))
* **inspector:** autofocus, Escape blur, life defaults, combobox fix ([2f1fcd8](https://github.com/rafael-graunke/spellsplice/commit/2f1fcd80dad4a93eb2f4ff2a6866e03f87b8ea7f))
* **inspector:** overhaul edition picker with virtual list + preview ([9899fa2](https://github.com/rafael-graunke/spellsplice/commit/9899fa237c59333886054ba61d8dea1934ded205))
* NLE export pipeline and player settings section ([e1ae0fa](https://github.com/rafael-graunke/spellsplice/commit/e1ae0fa191ffcdbd29ed9fdf1a1a4e5a239e5049))
* **nle:** add clip delete, undo/redo, and fix playback on delete ([636fa52](https://github.com/rafael-graunke/spellsplice/commit/636fa5226daae19cff433e8f9ae3c4957258a8d7))
* **nle:** add delete track context menu option ([e223494](https://github.com/rafael-graunke/spellsplice/commit/e2234940cb869f232429bb0482662fec66a9c91a))
* **nle:** add NLE timeline foundation with decoupled scroll/zoom ([31fd0d3](https://github.com/rafael-graunke/spellsplice/commit/31fd0d3a9379e51273770f71f3a0dcf3f51e7d7f))
* **nle:** add NLECursor playhead and arrow key seeking ([6418952](https://github.com/rafael-graunke/spellsplice/commit/6418952d26c157b022205aefceb7e6cd5fdce542))
* **nle:** add NLECursor playhead to track area ([368938c](https://github.com/rafael-graunke/spellsplice/commit/368938c7cd1e07dc71cee69bbaacf62acd703158))
* **nle:** add NLEEvent with cross-track drag for event tracks ([62bd3b7](https://github.com/rafael-graunke/spellsplice/commit/62bd3b77d9e62fc619b634fdc376108bdfe10be5))
* **nle:** add target player selection via TAB and track group click ([b7008e6](https://github.com/rafael-graunke/spellsplice/commit/b7008e65a3b4ac6af228d92e2da7a4fa6e98d1ee))
* **nle:** auto-layer event creation, persist config to autosave ([2620f1d](https://github.com/rafael-graunke/spellsplice/commit/2620f1d27897075a22bdcb16a532cca5340a426c))
* **nle:** give target track full event-panel width on focus ([b5f8f61](https://github.com/rafael-graunke/spellsplice/commit/b5f8f611e65b9dd37455228392d05273756bf319))
* **nle:** implement track mute, hide, and block controls ([65adda7](https://github.com/rafael-graunke/spellsplice/commit/65adda72a6a308c9950c669ae6424f55a761e821))
* **nle:** render waveforms and frame thumbnails on clips ([076c436](https://github.com/rafael-graunke/spellsplice/commit/076c43630f708f88c4d61341d9ce161b660de6fb))
* **nle:** replace Timeline with NLETimeline ([1f08fdd](https://github.com/rafael-graunke/spellsplice/commit/1f08fddc29e22072dc270f8bca12e52439481049))
* **nle:** wire zoom slider and split track groups into resizable panels ([f9ce498](https://github.com/rafael-graunke/spellsplice/commit/f9ce498e9e43400a603f4f16ab45642ff1c4d45a))
* **overlay:** add HIDE_UI, SHOW_UI, RESET events; unify hand state ([4955167](https://github.com/rafael-graunke/spellsplice/commit/4955167ce09821401b16858d9144586e67d91b01))
* **preview:** add hover volume slider ([260dcff](https://github.com/rafael-graunke/spellsplice/commit/260dcffd06c31017c6b82f01103ac8553d8bd2a6))
* **renders:** add anti-aliased pill clip for modern frame strips ([d087002](https://github.com/rafael-graunke/spellsplice/commit/d087002520228e1e87de2e82015ba75ac3a20f29))
* **renders:** animate display-card and deck-stack overlays ([6741da3](https://github.com/rafael-graunke/spellsplice/commit/6741da39a905794b03a042ae293181ebf84d79a6))
* **renders:** animate hand stack entries and exits ([e0a89e0](https://github.com/rafael-graunke/spellsplice/commit/e0a89e07c65403c509ac195df1f03fc733c6632b))
* **renders:** per-card strip height from crop dimensions ([4d8b38c](https://github.com/rafael-graunke/spellsplice/commit/4d8b38c3ccca19c3eaae5776d26c6b52a4084122))
* **settings:** add settings dialog with overlay-start-hidden option ([764f2dc](https://github.com/rafael-graunke/spellsplice/commit/764f2dcf8d4a78c9e3fd81079803c905107fe0a9))
* source management, NLE view modes, and session persistence ([920813b](https://github.com/rafael-graunke/spellsplice/commit/920813be591ab1041f41eae377de165c6585d985))
* **sources:** offline detection and relink on project open ([76cd7bc](https://github.com/rafael-graunke/spellsplice/commit/76cd7bc926d6ec34468a80baf937bb8a7401e3a1))
* **timeline:** add 'Create event' context menu item, platform-aware shortcuts ([2780041](https://github.com/rafael-graunke/spellsplice/commit/2780041ada4ec54bbbd94d89a6d77180466be0e9))
* **timeline:** add delta-based undo/redo with Ctrl+Z ([bd3bc4d](https://github.com/rafael-graunke/spellsplice/commit/bd3bc4d821e6650ffc78088a22349c6a9e43bf0d))
* **timeline:** add edge-scroll, dynamic lanes, and fix ghost sizing ([3f51e85](https://github.com/rafael-graunke/spellsplice/commit/3f51e85b0105c1f19cb36b6b0b20dc98b03b7cb2))
* **timeline:** add WIN event and UX polish ([5c897db](https://github.com/rafael-graunke/spellsplice/commit/5c897dbdf6251e94a1a151d2617f6d690a690033))
* **timeline:** copy/paste events, keyboard delete, fix context menu deselect ([d5fc5fc](https://github.com/rafael-graunke/spellsplice/commit/d5fc5fc590f4652cc19b2bdc93707b53c8ca2719))


### Performance Improvements

* **nle:** debounce waveform canvas redraw on zoom ([1b4a2bb](https://github.com/rafael-graunke/spellsplice/commit/1b4a2bb9018f3bf6b916f6b58cfd79ba27953b4a))
* **timeline:** memoize component tree to eliminate cascade re-renders ([7755a34](https://github.com/rafael-graunke/spellsplice/commit/7755a348b46100465c345839311ed05b92dc0959))

# [0.9.0-rc.2](https://github.com/rafael-graunke/spellsplice/compare/v0.9.0-rc.1...v0.9.0-rc.2) (2026-06-30)


### Bug Fixes

* **export:** include HIDE_UI/SHOW_UI in overlay animation guard ([48f3565](https://github.com/rafael-graunke/spellsplice/commit/48f3565b11d7d5207c69c46b16e7e36c90d1c575))
* **export:** pass overlayStartHidden to video export pipeline ([82619e5](https://github.com/rafael-graunke/spellsplice/commit/82619e591c57228ed337801b4b55d4557df6eea8))


### Features

* **nle:** auto-layer event creation, persist config to autosave ([2620f1d](https://github.com/rafael-graunke/spellsplice/commit/2620f1d27897075a22bdcb16a532cca5340a426c))

# [0.9.0-rc.1](https://github.com/rafael-graunke/spellsplice/compare/v0.8.0...v0.9.0-rc.1) (2026-06-30)


### Bug Fixes

* **export:** fix animation frame duplication and broken exit animations ([9ad7165](https://github.com/rafael-graunke/spellsplice/commit/9ad7165cbc2c0341e2a6fd96f58d340d2d1c01a9))
* **inspector:** restore autofocus on event creation from command palette ([cb380d3](https://github.com/rafael-graunke/spellsplice/commit/cb380d3b0d080bf7263a7bd1c748a472616edb73))
* **nle:** enable cross-player event drag ([001e782](https://github.com/rafael-graunke/spellsplice/commit/001e7820777e3de728ef2856f6eb5d361a85d2c8))
* **nle:** fix cross-group drag companion placement ([7de38c7](https://github.com/rafael-graunke/spellsplice/commit/7de38c76c56bc4fdba3435ea9e3b67e71b4494b0))
* **nle:** fix multi-select, delete, copy, undo bugs and remove dead code ([36cf6fe](https://github.com/rafael-graunke/spellsplice/commit/36cf6fe79d96e72894798f36daf7ba5a25c5fea2))
* **nle:** persist clips/overrides, clamp drags, fix audio sync on seek ([83ba9f2](https://github.com/rafael-graunke/spellsplice/commit/83ba9f2f3fd2e01caa4e80efb9e1f25ce4890d05))
* **nle:** require mouse movement before activating event drag ([8e9dabc](https://github.com/rafael-graunke/spellsplice/commit/8e9dabc5018e60707290bb44d4ab8f1ac6b6432c))
* **nle:** resolve inspector using wrong player after cross-player drag ([85377af](https://github.com/rafael-graunke/spellsplice/commit/85377af54d4dd5e57ab10cc931e132776fddf48b))
* **renders:** tune crop constants and hand stack bottom margin ([26b29c7](https://github.com/rafael-graunke/spellsplice/commit/26b29c74b2de44d6b2c2be9a751929bf46776f33))
* **timeline:** add horizontal edge scroll and fix time delta during scroll ([572493e](https://github.com/rafael-graunke/spellsplice/commit/572493eecfa329487394c0201fb69ab8014765a5))
* **timeline:** replace background-attachment:local with scroll-synced backgroundPositionY ([b76a23c](https://github.com/rafael-graunke/spellsplice/commit/b76a23cc5a24ab4273445f53f3ddc8fe71e9e4b1))


### Features

* add error boundary with crash screen and issue report link ([fff3fbe](https://github.com/rafael-graunke/spellsplice/commit/fff3fbe2e4c9146c1f088c59d8820187c7e0546b))
* **appbar:** show app version in top bar ([fc1c411](https://github.com/rafael-graunke/spellsplice/commit/fc1c411f3c69ea36602a8b2e33a8643a77448299))
* **inspector:** autofocus, Escape blur, life defaults, combobox fix ([2f1fcd8](https://github.com/rafael-graunke/spellsplice/commit/2f1fcd80dad4a93eb2f4ff2a6866e03f87b8ea7f))
* **inspector:** overhaul edition picker with virtual list + preview ([9899fa2](https://github.com/rafael-graunke/spellsplice/commit/9899fa237c59333886054ba61d8dea1934ded205))
* NLE export pipeline and player settings section ([e1ae0fa](https://github.com/rafael-graunke/spellsplice/commit/e1ae0fa191ffcdbd29ed9fdf1a1a4e5a239e5049))
* **nle:** add clip delete, undo/redo, and fix playback on delete ([636fa52](https://github.com/rafael-graunke/spellsplice/commit/636fa5226daae19cff433e8f9ae3c4957258a8d7))
* **nle:** add delete track context menu option ([e223494](https://github.com/rafael-graunke/spellsplice/commit/e2234940cb869f232429bb0482662fec66a9c91a))
* **nle:** add NLE timeline foundation with decoupled scroll/zoom ([31fd0d3](https://github.com/rafael-graunke/spellsplice/commit/31fd0d3a9379e51273770f71f3a0dcf3f51e7d7f))
* **nle:** add NLECursor playhead and arrow key seeking ([6418952](https://github.com/rafael-graunke/spellsplice/commit/6418952d26c157b022205aefceb7e6cd5fdce542))
* **nle:** add NLECursor playhead to track area ([368938c](https://github.com/rafael-graunke/spellsplice/commit/368938c7cd1e07dc71cee69bbaacf62acd703158))
* **nle:** add NLEEvent with cross-track drag for event tracks ([62bd3b7](https://github.com/rafael-graunke/spellsplice/commit/62bd3b77d9e62fc619b634fdc376108bdfe10be5))
* **nle:** add target player selection via TAB and track group click ([b7008e6](https://github.com/rafael-graunke/spellsplice/commit/b7008e65a3b4ac6af228d92e2da7a4fa6e98d1ee))
* **nle:** give target track full event-panel width on focus ([b5f8f61](https://github.com/rafael-graunke/spellsplice/commit/b5f8f611e65b9dd37455228392d05273756bf319))
* **nle:** implement track mute, hide, and block controls ([65adda7](https://github.com/rafael-graunke/spellsplice/commit/65adda72a6a308c9950c669ae6424f55a761e821))
* **nle:** render waveforms and frame thumbnails on clips ([076c436](https://github.com/rafael-graunke/spellsplice/commit/076c43630f708f88c4d61341d9ce161b660de6fb))
* **nle:** replace Timeline with NLETimeline ([1f08fdd](https://github.com/rafael-graunke/spellsplice/commit/1f08fddc29e22072dc270f8bca12e52439481049))
* **nle:** wire zoom slider and split track groups into resizable panels ([f9ce498](https://github.com/rafael-graunke/spellsplice/commit/f9ce498e9e43400a603f4f16ab45642ff1c4d45a))
* **overlay:** add HIDE_UI, SHOW_UI, RESET events; unify hand state ([4955167](https://github.com/rafael-graunke/spellsplice/commit/4955167ce09821401b16858d9144586e67d91b01))
* **preview:** add hover volume slider ([260dcff](https://github.com/rafael-graunke/spellsplice/commit/260dcffd06c31017c6b82f01103ac8553d8bd2a6))
* **renders:** add anti-aliased pill clip for modern frame strips ([d087002](https://github.com/rafael-graunke/spellsplice/commit/d087002520228e1e87de2e82015ba75ac3a20f29))
* **renders:** animate display-card and deck-stack overlays ([6741da3](https://github.com/rafael-graunke/spellsplice/commit/6741da39a905794b03a042ae293181ebf84d79a6))
* **renders:** animate hand stack entries and exits ([e0a89e0](https://github.com/rafael-graunke/spellsplice/commit/e0a89e07c65403c509ac195df1f03fc733c6632b))
* **renders:** per-card strip height from crop dimensions ([4d8b38c](https://github.com/rafael-graunke/spellsplice/commit/4d8b38c3ccca19c3eaae5776d26c6b52a4084122))
* **settings:** add settings dialog with overlay-start-hidden option ([764f2dc](https://github.com/rafael-graunke/spellsplice/commit/764f2dcf8d4a78c9e3fd81079803c905107fe0a9))
* source management, NLE view modes, and session persistence ([920813b](https://github.com/rafael-graunke/spellsplice/commit/920813be591ab1041f41eae377de165c6585d985))
* **sources:** offline detection and relink on project open ([76cd7bc](https://github.com/rafael-graunke/spellsplice/commit/76cd7bc926d6ec34468a80baf937bb8a7401e3a1))
* **timeline:** add 'Create event' context menu item, platform-aware shortcuts ([2780041](https://github.com/rafael-graunke/spellsplice/commit/2780041ada4ec54bbbd94d89a6d77180466be0e9))
* **timeline:** add delta-based undo/redo with Ctrl+Z ([bd3bc4d](https://github.com/rafael-graunke/spellsplice/commit/bd3bc4d821e6650ffc78088a22349c6a9e43bf0d))
* **timeline:** add edge-scroll, dynamic lanes, and fix ghost sizing ([3f51e85](https://github.com/rafael-graunke/spellsplice/commit/3f51e85b0105c1f19cb36b6b0b20dc98b03b7cb2))
* **timeline:** add WIN event and UX polish ([5c897db](https://github.com/rafael-graunke/spellsplice/commit/5c897dbdf6251e94a1a151d2617f6d690a690033))
* **timeline:** copy/paste events, keyboard delete, fix context menu deselect ([d5fc5fc](https://github.com/rafael-graunke/spellsplice/commit/d5fc5fc590f4652cc19b2bdc93707b53c8ca2719))


### Performance Improvements

* **nle:** debounce waveform canvas redraw on zoom ([1b4a2bb](https://github.com/rafael-graunke/spellsplice/commit/1b4a2bb9018f3bf6b916f6b58cfd79ba27953b4a))
* **timeline:** memoize component tree to eliminate cascade re-renders ([7755a34](https://github.com/rafael-graunke/spellsplice/commit/7755a348b46100465c345839311ed05b92dc0959))

# [0.8.0](https://github.com/rafael-graunke/spellsplice/compare/v0.7.0...v0.8.0) (2026-05-05)


### Features

* **inspector:** add dnd-kit drag-to-reorder for card lists ([461ff16](https://github.com/rafael-graunke/spellsplice/commit/461ff16c537e4d3b540157c9ca875dd06106326d))
* **renders:** add deck stack overlay and fix paused-frame image refresh ([2dbd2c1](https://github.com/rafael-graunke/spellsplice/commit/2dbd2c1a1add8b9f69ec1e2a8eb7b259c0db74ed))
* **state:** implement STACK_DECK replace semantics with pre-population ([f3f121d](https://github.com/rafael-graunke/spellsplice/commit/f3f121db86db178fe19ebbdbd2750b4067656b33))

# [0.8.0-rc.1](https://github.com/rafael-graunke/spellsplice/compare/v0.7.0...v0.8.0-rc.1) (2026-05-05)


### Features

* **inspector:** add dnd-kit drag-to-reorder for card lists ([461ff16](https://github.com/rafael-graunke/spellsplice/commit/461ff16c537e4d3b540157c9ca875dd06106326d))
* **renders:** add deck stack overlay and fix paused-frame image refresh ([2dbd2c1](https://github.com/rafael-graunke/spellsplice/commit/2dbd2c1a1add8b9f69ec1e2a8eb7b259c0db74ed))
* **state:** implement STACK_DECK replace semantics with pre-population ([f3f121d](https://github.com/rafael-graunke/spellsplice/commit/f3f121db86db178fe19ebbdbd2750b4067656b33))

# [0.7.0](https://github.com/rafael-graunke/spellsplice/compare/v0.6.0...v0.7.0) (2026-05-03)


### Bug Fixes

* **assets:** move static SVGs into public/assets/ ([3635d32](https://github.com/rafael-graunke/spellsplice/commit/3635d3231109c0430fac2736ee81d7eed1b21230))
* **export:** add Opus audio to WebM export ([e8f96fd](https://github.com/rafael-graunke/spellsplice/commit/e8f96fd6ec6647b6a2a55dcc670fb70aca781e7b))
* **export:** replace decoder.flush() with reset() to fix Windows hang ([2b19e62](https://github.com/rafael-graunke/spellsplice/commit/2b19e62be0f3510c73d98aaf2191862c3b81e124))
* **export:** use AVCC format for AVC encoder output ([f86a26f](https://github.com/rafael-graunke/spellsplice/commit/f86a26f373788ff0f146faae6c948cf2c40911fb))
* **export:** use H.264 High L4.2 for codec detection ([c751ed4](https://github.com/rafael-graunke/spellsplice/commit/c751ed4ddc0c552595667083ec3eaa5cf18ec490))
* **export:** use realtime latency mode to prevent encoder stall ([bb3d529](https://github.com/rafael-graunke/spellsplice/commit/bb3d52988da706ea0f5cee102a6a7cd8fc94f2fd))
* **timeline,inspector:** sticky ruler, cursor fixes, card/hand UX ([b4fccd7](https://github.com/rafael-graunke/spellsplice/commit/b4fccd7b67e8f109c86c98df29646d894f2915e1))
* **timeline:** clip cursor overflow to prevent phantom scrollbar ([bb565a3](https://github.com/rafael-graunke/spellsplice/commit/bb565a371541a53f3fa54e23bf0f95425d02df5d))
* **timeline:** time seek bugged ([4f630ac](https://github.com/rafael-graunke/spellsplice/commit/4f630ac755120f1ec19d20313284c8b3eaeb5e65))


### Features

* adds decklist import and user info editing ([de96727](https://github.com/rafael-graunke/spellsplice/commit/de9672724f55e1735e6ed898a233396806582d5f))
* **export:** add in-browser video export with overlay baking ([3b64064](https://github.com/rafael-graunke/spellsplice/commit/3b640646024b8ffc0d9c04500e149b8ff6b1ae78))
* **export:** WIP in-browser video export with overlay baking ([74dbf51](https://github.com/rafael-graunke/spellsplice/commit/74dbf5139136de2bb45b00fd1f4585424338163b))
* **export:** WIP replace ffmpeg with mp4-muxer + mp4box audio passthrough ([ebe34c9](https://github.com/rafael-graunke/spellsplice/commit/ebe34c973038f19361d36140c431c1e0a1b1cad6))


### Performance Improvements

* **export:** raise bitrate to 20 Mbps, keyframe interval to 10s ([ddbd3e4](https://github.com/rafael-graunke/spellsplice/commit/ddbd3e43ba018471fe5de25ebd34dc0573ad4f13))
* **preview:** switch to WebGL compositor + requestVideoFrameCallback ([e2edb82](https://github.com/rafael-graunke/spellsplice/commit/e2edb82c09f3256b76f7f63781e77efa2f2e7264))
* **timeline:** drive cursor via rAF + imperative ref ([166f72e](https://github.com/rafael-graunke/spellsplice/commit/166f72eeecb585f12e6545143d5e6ad2315396c3))

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
