var $grooveShredderQuery = jQuery.noConflict();
var orgArgeeCodeGrooveShredder = {};

orgArgeeCodeGrooveShredder.pref_service = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
orgArgeeCodeGrooveShredder.gpreferences = orgArgeeCodeGrooveShredder.pref_service.getBranch("extensions.grooveshredder");

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

orgArgeeCodeGrooveShredder.grooveRequestObserver = 
{
	observe: function(subject, topic, data)
	{
		if(typeof(Components) !== 'undefined'){
			var channel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
			var re = /http:\/\/grooveshark.com\/more.php\?getStreamKeyFromSongIDEx$/;
			if(channel.URI.spec.match(re)){
				var notificationCallbacks = channel.notificationCallbacks;
				var domWin = notificationCallbacks.getInterface(Components.interfaces.nsIDOMWindow);
				this.theApp.browser = gBrowser.getBrowserForDocument(domWin.top.document);
				this.original = this.original? false : true;
				if(this.original) this.theApp.utility.createButton(this.theApp.utility.getPostData(subject), 0);
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
		var song_name = $grooveShredderQuery(songBox).find('.currentSongLink').attr('title');
		var song_artist = $grooveShredderQuery(songBox).find('.artist').attr('title');
		var song_album = $grooveShredderQuery(songBox).find('.album').attr('title');
		var file_pref = this.theApp.gpreferences.getCharPref(".filename");
		this.song_file = file_pref.replace("%artist%", song_artist)
									.replace("%title%", song_name)
										.replace("%album%", song_album).replace("\\", "") + ".mp3";
	},
	runFilePicker: function()
	{
		var directory = this.theApp.utility.getDirectory();
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
			else return false;
		} else {
			directory.appendRelativePath(this.song_file);
			this.thefile = directory;
			this.obj_URI = this.ios.newURI(this.url, null, null);
			this.file_URI = this.ios.newFileURI(this.thefile);
			if(this.thefile.exists()){
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
				if(times<10) orgArgeeCodeGrooveShredder.utility.createButton(iden, times+1);
				var element;
				var url_patt = /"ip":"(.*)"}/;
				var key_patt = /"streamKey":"(.*)",/;
				var stream_url = result.match(url_patt)[1];
				var stream_key = result.match(key_patt)[1];
				// Add a button to grooveshark
				element = theApp.browser.contentDocument.getElementById("playerDetails_nowPlaying");
				$grooveShredderQuery(element).children('b').remove();
				$grooveShredderQuery(element).append('<b id="playerDetails_grooveShredder" style="\
									cursor:pointer; \
									color: #fff; \
									font-weight: normal; \
									margin-left: 10px; \
									padding: 2px 4px 2px 24px; \
									-moz-border-radius: 2px; \
									background: #888 url(chrome://grooveshredder/skin/shark-s.png) no-repeat 4px center;"> \
									Download Song</b>');
				$grooveShredderQuery(element).children('b').click(function(){
					theApp.grooveDownloader.execute(stream_url, stream_key);
				});
				
				// Autodownload if preferred
				if(theApp.gpreferences.getBoolPref(".autoget") && times == 10){
					theApp.grooveDownloader.execute(stream_url, stream_key);
				}
			}
		});
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
		Components.utils.import("resource://gre/modules/FileUtils.jsm");
		if(!this.theApp.gpreferences.prefHasUserValue('.downloc')){
			return FileUtils.getDir("Desk", []);
		} else {
			var directory = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
			directory.initWithPath(this.theApp.gpreferences.getCharPref('.downloc'));
			return directory;
		}
	},
	theApp : orgArgeeCodeGrooveShredder
}

window.addEventListener("load", function () { orgArgeeCodeGrooveShredder.grooveshredder.onLoad(); }, false);