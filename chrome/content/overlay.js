/* Declaring namespaces to prevent conflicts */
var $grooveShredderQuery = jQuery.noConflict();
var orgArgeeCodeGrooveShredder = {};

/* Global Variables contained in the namespace */
orgArgeeCodeGrooveShredder.pref_service = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
orgArgeeCodeGrooveShredder.gpreferences = orgArgeeCodeGrooveShredder.pref_service.getBranch("extensions.grooveshredder");

/* Handler for the main listener and toolbar logic */
orgArgeeCodeGrooveShredder.grooveshredder = {
  onLoad: function() {
    // initialization code
    this.theApp.grooveRequestObserver.register();
    // to be or not to be
    if(this.theApp.gpreferences.prefHasUserValue("enabled")){
    	if(this.theApp.gpreferences.getBoolPref("enabled")){
    		this.setEnabled();
    	} else {
    		this.setDisabled();
    	}
    } else {
    	this.setEnabled();
    }
  },
  onToolbarButtonCommand: function(e) {
    // If on turn off, if off turn on!
    if(this.initialized){
    	this.setDisabled();
		alert("Grooveshredder is now disabled.");
	} else {
		this.setEnabled();
		alert("Grooveshredder is now enabled.");
	}
  },
  setEnabled: function() {
  		var btn = document.getElementById("grooveshredder-toolbar-button");
		this.initialized = true;
		this.theApp.gpreferences.setBoolPref("enabled", true);
		this.theApp.grooveRequestObserver.register();
		if(btn !== null)
			btn.setAttribute("class","grooveshredder-tbutton-on toolbarbutton-1 chromeclass-toolbar-additional");  
  },
  setDisabled: function() {
  		var btn = document.getElementById("grooveshredder-toolbar-button");
		this.initialized = false;
		this.theApp.gpreferences.setBoolPref("enabled", false);
		this.theApp.grooveRequestObserver.unregister();
		btn.setAttribute("class","grooveshredder-tbutton-off toolbarbutton-1 chromeclass-toolbar-additional");
  },
  theApp : orgArgeeCodeGrooveShredder
};

/* The HTTP Observer / Listener that monitors requests */
orgArgeeCodeGrooveShredder.grooveRequestObserver = 
{
	observe: function(subject, topic, data)
	{
		if(typeof(Components) !== 'undefined'){
			var channel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
			var song_url = /http:\/\/grooveshark.com\/more.php\?getStreamKeyFromSongIDEx$/;
			var list_url = /http:\/\/grooveshark.com\/more.php\?playlistGetSongs$/;
			if(channel.URI.spec.match(song_url)){
				var notificationCallbacks = channel.notificationCallbacks;
				var domWin = notificationCallbacks.getInterface(Components.interfaces.nsIDOMWindow);
				this.theApp.browser = gBrowser.getBrowserForDocument(domWin.top.document);
				this.original = this.original? false : true;
				if(this.original) this.theApp.utility.createButton(this.theApp.utility.getPostData(subject), 0);
			} else if(channel.URI.spec.match(list_url)){
				this.theApp.browser = gBrowser.getBrowserForDocument(window.document);
				this.theApp.utility.createListButton(this.theApp.utility.getPostData(subject));
			} else {
				var re = /http:\/\/grooveshark.com\/.*$/;
				if(channel.URI.spec.match(re)){
					this.theApp.utility.addOptionsLink();
				}
			}
		}
	},
	get observerService() {
		return Components.classes["@mozilla.org/observer-service;1"]
						 .getService(Components.interfaces.nsIObserverService);
	},
	register: function()
	{
		this.original = true;
		this.observerService.addObserver(this, "http-on-modify-request", false);
	},
	unregister: function()
	{
		this.observerService.removeObserver(this, "http-on-modify-request");
	},
	theApp : orgArgeeCodeGrooveShredder
};

/* This 'class' handles most of the download logic */
orgArgeeCodeGrooveShredder.grooveDownloader = 
{
	init: function(url, dataString) {
		this.ios = Components.classes['@mozilla.org/network/io-service;1']
						.getService(Components.interfaces.nsIIOService);
		this.persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                        .createInstance(Components.interfaces.nsIWebBrowserPersist);
		this.xfer = Components.classes["@mozilla.org/transfer;1"].createInstance(Components.interfaces.nsITransfer);
		
		this.url = 'http://'+url+'/stream.php';
		this.data = this.theApp.utility.newPostData(dataString);
	},
	getFileName: function()
	{
		var songBox = this.theApp.browser.contentDocument.getElementById("playerDetails_nowPlaying");
		this.theApp.song_name = $grooveShredderQuery(songBox).find('.currentSongLink').attr('title');
		this.theApp.song_artist = $grooveShredderQuery(songBox).find('.artist').attr('title');
		this.theApp.song_album = $grooveShredderQuery(songBox).find('.album').attr('title');
		var file_pref = this.theApp.gpreferences.getCharPref(".filename");
		this.song_file = file_pref.replace("%artist%", this.theApp.song_artist)
									.replace("%title%", this.theApp.song_name)
										.replace("%album%", this.theApp.song_album)
											.replace(/[\#%&\*:<>\?\/\\\{\|\}\.]/g,"") + ".mp3";
	},
	runFilePicker: function()
	{
		var automade = false;
		var directory = this.theApp.utility.getDirectory();
		if(!directory.exists()){
			directory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
			automade = true;
		}
		if(!this.theApp.gpreferences.getBoolPref(".nodialog")){
			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window, "Save GrooveShredded File As...", nsIFilePicker.modeSave);
			fp.appendFilter("MP3 Files","*.mp3");
			fp.displayDirectory = directory;
			fp.defaultString = this.song_file;
			var res = fp.show();
			if (res == nsIFilePicker.returnOK || res == nsIFilePicker.returnReplace){
				this.thefile = fp.file;
				this.obj_URI = this.ios.newURI(this.url, null, null);
				this.file_URI = this.ios.newFileURI(this.thefile);
				return true;
			}
			else {
				if(automade) directory.remove(false);
				return false;
			}
		} else {
			directory.appendRelativePath(this.song_file);
			this.thefile = directory;
			this.obj_URI = this.ios.newURI(this.url, null, null);
			this.file_URI = this.ios.newFileURI(this.thefile);
			if(this.thefile.exists()){
				if(this.theApp.gpreferences.getBoolPref(".nodupeprompt")) return false;
				if(!confirm(this.song_file+'\r\nFile exists in target location. Overwrite?')) return false;
			}
			return true;
		}
	},
	saveSong: function()
	{
		var dbutton = this.theApp.browser.contentDocument.getElementById("playerDetails_grooveShredder");
		$grooveShredderQuery(dbutton).animate({opacity:0.25},800).unbind('click').click(function(){alert('Please re-add song to queue to download again');});
		this.xfer.init(this.obj_URI, this.file_URI, "", null, null, null, this.persist);
		this.persist.progressListener = this.xfer; 
		this.persist.saveURI(this.obj_URI, null, null, this.data, "", this.thefile);	
	},
	execute: function(url, data)
	{
		this.init(url, data);
		this.getFileName();
		if(this.runFilePicker()){
			this.saveSong();
		}
	},
	theApp : orgArgeeCodeGrooveShredder
};

/* Utility functions used throughout the extension */
orgArgeeCodeGrooveShredder.utility = 
{
	createButton: function(iden, times){
		var theApp = orgArgeeCodeGrooveShredder;
		$grooveShredderQuery.ajax({
			url: 'http://grooveshark.com/more.php?getStreamKeyFromSongIDEx=',
			type: 'POST',
			data: iden,
			dataType: 'text',
			contentType: 'application/json',
			success: function(result) {
				// Repeat 10x to ensure fresh key
				if(times<5) orgArgeeCodeGrooveShredder.utility.createButton(iden, times+1);
				var element;
				var url_patt = /"ip":"([^"]+)"/;
				var key_patt = /"streamKey":"([^"]+)"/;
				var stream_url = result.match(url_patt)[1];
				var stream_key = result.match(key_patt)[1];
				// Add a button to grooveshark
				element = theApp.browser.contentDocument.getElementById("playerDetails_nowPlaying");
				$grooveShredderQuery(element).children('b').remove();
				$grooveShredderQuery(element).append('<b id="playerDetails_grooveShredder"> \
																Download Song</b>');
				$grooveShredderQuery(element).children('b').click(function(){
					theApp.grooveDownloader.execute(stream_url, stream_key);
				});
				
				// Autodownload if preferred
				if(theApp.gpreferences.getBoolPref(".autoget") && times == 5){
					theApp.grooveDownloader.execute(stream_url, stream_key);
					// Skip to next song if preferred
					if(theApp.gpreferences.getBoolPref(".autonext")){
						element = theApp.browser.contentDocument.getElementById("player_controls_playback");
						$grooveShredderQuery(element).children('#player_next').trigger('click');
					}
				}
			}
		});
	},
	createListButton: function(postdata){
		var theApp = orgArgeeCodeGrooveShredder;
		var country = postdata.match(/"country":\{[^}]+\}/);
		var headers = postdata.match(/"header":{[^{]+[{][^}]+[}][^}]+}/);
		$grooveShredderQuery.ajax({
			url: 'http://grooveshark.com/more.php?playlistGetSongs=',
			type: 'POST',
			data: postdata,
			dataType: 'text',
			contentType: 'application/json',
			success: function(result) {
				// Parse an array of song IDs from the JSON
				var songIds = result.match(/"SongID":"[0-9]+"/g);
				// Add a button next to the playlist name
				// This might be risky as Grooveshark tab needs to be selected
				var element = top.window.content.document.getElementById("page_header");
				$grooveShredderQuery(element).children('b').remove();
				$grooveShredderQuery(element).append('<b id="playlistName_grooveShredder"> \
																Download Song</b>');
				$grooveShredderQuery(element).children('b').click(function(){
					songIds.forEach(function(songId){
							// Prepare the POST data
							var toSend = '{"method":"getStreamKeyFromSongIDEx","parameters":{"mobile":false,"prefetch":false,'+ country +','+ songId +'},'+ headers +'}';
							// Replace invalid client
							toSend = toSend.replace("htmlshark", "jsqueue");
							alert(toSend);
							// Fetch the stream key
							$grooveShredderQuery.ajax({
								url: 'http://grooveshark.com/more.php?getStreamKeyFromSongIDEx=',
								type: 'POST',
								data: toSend,
								dataType: 'text',
								contentType: 'application/json',
								success: function(result) {
									var element;
									var url_patt = /"ip":"([^"]+)"/;
									var key_patt = /"streamKey":"([^"]+)"/;
									var stream_url = result.match(url_patt)[1];
									var stream_key = result.match(key_patt)[1];
									theApp.grooveDownloader.execute(stream_url, stream_key);
								}
							});
					});
				});
			}
		});
	},
	addOptionsLink: function(){
		// At the moment this function adds both CSS and the options link
		var topBar = gBrowser.contentDocument.getElementById("header");
		if($grooveShredderQuery(topBar).find('#grooveshark').size() > 0
				&& $grooveShredderQuery(topBar).find('#gs-options-link').size() == 0){
			$grooveShredderQuery(topBar).append('<a id="gs-options-link"> \
													Groove Shredder Options</a>');
			var headElement = gBrowser.contentDocument.getElementsByTagName("head")[0];
			$grooveShredderQuery(headElement).append('<link rel="stylesheet" type="text/css" \
														href="resource://grooveshredder/page.css"/>');
			// Add the event to make things work
			$grooveShredderQuery(topBar).find('#gs-options-link').click(function(){
				window.open("chrome://grooveshredder/content/options.xul", 
								"Groove Shredder preferences", "chrome, centerscreen");
			});
		}
	},
	getPostData: function(subject){
		var dataStream = subject.QueryInterface(Components.interfaces.nsIUploadChannel).uploadStream;
		dataStream.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
		var stream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
		stream.setInputStream(dataStream);
		var postBytes = stream.readByteArray(stream.available());
		var poststr = String.fromCharCode.apply(null, postBytes);
		dataStream.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
		var re = /{.*}/;
		return poststr.match(re)[0];
	},
	newPostData: function(dataString){
		dataString = 'streamKey='+dataString.replace('_', '%5F');
		const Cc = Components.classes;
		const Ci = Components.interfaces;
		var stringStream = Cc["@mozilla.org/io/string-input-stream;1"].
						   createInstance(Ci.nsIStringInputStream);
		if ("data" in stringStream) // Gecko 1.9 or newer
		  stringStream.data = dataString;
		else // 1.8 or older
		  stringStream.setData(dataString, dataString.length);
		var postData = Cc["@mozilla.org/network/mime-input-stream;1"].
					   createInstance(Ci.nsIMIMEInputStream);
		postData.addHeader("Content-Type", "application/x-www-form-urlencoded");
		postData.addContentLength = true;
		postData.setData(stringStream);
		return postData;
	},
	getDirectory: function(){
		var directory;
		Components.utils.import("resource://gre/modules/FileUtils.jsm");
		if(!this.theApp.gpreferences.prefHasUserValue('.downloc')){
			directory = FileUtils.getDir("Desk", []);
		} else {
			var dir = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
			dir.initWithPath(this.theApp.gpreferences.getCharPref('.downloc'));
			directory = dir;
		}
		
		if(this.theApp.gpreferences.getBoolPref('.playdir')){
			var playDetails = this.theApp.browser.contentDocument.getElementById("page_header");
			var subdir = $grooveShredderQuery(playDetails).find('.name').html();
			if(typeof(subdir) !== undefined){
				if(subdir == null) {
					subdir = $grooveShredderQuery(playDetails).find('span').html();
				}
				if(subdir != null) {
					// Sanitize and append
					subdir = subdir.replace(/^\s+|\s+$/g,"").replace(/[\#%&\*:<>\?\/\\\{\|\}\.]/g,"");
					directory.appendRelativePath(subdir);
				}
			}
		} else if(this.theApp.gpreferences.prefHasUserValue('.downdir')){
			var dir_pref = this.theApp.gpreferences.getCharPref(".downdir");
			var subdir = dir_pref.replace("%artist%", this.theApp.song_artist)
									.replace("%title%", this.theApp.song_name)
										.replace("%album%", this.theApp.song_album).replace(/[\#%&\*:<>\?\/\\\{\|\}\.]/g,"");
			directory.appendRelativePath(subdir);
		}
		
		// Deal with second sub-directory option
		if(this.theApp.gpreferences.prefHasUserValue('.subdowndir')){
			var dir_pref = this.theApp.gpreferences.getCharPref(".subdowndir");
			var subdir = dir_pref.replace("%artist%", this.theApp.song_artist)
									.replace("%title%", this.theApp.song_name)
										.replace("%album%", this.theApp.song_album).replace(/[\#%&\*:<>\?\/\\\{\|\}\.]/g,"");
			directory.appendRelativePath(subdir);
		}
		
		return directory;
	},
	theApp : orgArgeeCodeGrooveShredder
}

window.addEventListener("load", function () { orgArgeeCodeGrooveShredder.grooveshredder.onLoad(); }, false);
