var pref_service = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
var gpreferences = pref_service.getBranch("extensions.grooveshredder");

var grooveshredder = {
  onLoad: function() {
    // initialization code
    grooveRequestObserver.register();
    // to be or not to be
    if(gpreferences.prefHasUserValue("enabled")){
    	if(gpreferences.getBoolPref("enabled")){
    		grooveshredder.setEnabled();
    	} else {
    		grooveshredder.setDisabled();
    	}
    } else {
    	grooveshredder.setEnabled();
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
		gpreferences.setBoolPref("enabled", true);
		grooveRequestObserver.register();
		btn.setAttribute("class","grooveshredder-tbutton-on toolbarbutton-1 chromeclass-toolbar-additional");  
  },
  setDisabled: function() {
  		var btn = document.getElementById("grooveshredder-toolbar-button");
		this.initialized = false;
		gpreferences.setBoolPref("enabled", false);
		grooveRequestObserver.unregister();
		btn.setAttribute("class","grooveshredder-tbutton-off toolbarbutton-1 chromeclass-toolbar-additional");
  }
};

var grooveRequestObserver =
{
  observe: function(subject, topic, data)
  {
	if(typeof(Components) !== 'undefined'){
		var channel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
		var re = /http:\/\/grooveshark.com\/more.php\?getStreamKeyFromSongIDEx$/;
		if(channel.URI.spec.match(re)){
			createButton(getPostData(subject), 0);
		}
	}
  },
  get observerService() {
    return Components.classes["@mozilla.org/observer-service;1"]
                     .getService(Components.interfaces.nsIObserverService);
  },
  register: function()
  {
    this.observerService.addObserver(this, "http-on-modify-request", false);
  },
  unregister: function()
  {
    this.observerService.removeObserver(this, "http-on-modify-request");
  }
};

var grooveDownloader = {
	init: function(url, dataString) {
		this.ios = Components.classes['@mozilla.org/network/io-service;1']
						.getService(Components.interfaces.nsIIOService);
		this.persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                        .createInstance(Components.interfaces.nsIWebBrowserPersist);
		this.xfer = Components.classes["@mozilla.org/transfer;1"].createInstance(Components.interfaces.nsITransfer);
		
		this.url = 'http://'+url+'/stream.php';
		this.data = newPostData(dataString);
	},
	getFileName: function()
	{
		var songDetails = content.document.getElementById("playerDetails_nowPlaying").innerHTML;
		var name_regex = /class="song.*" title="(.*)"/;
		var from_regex = /class="artist.*" title="(.*)"/;
		var album_regex = /class="album.*" title="(.*)"/;
		var song_name = songDetails.match(name_regex)[1].replace("&amp;", "&");
		var song_artist = songDetails.match(from_regex)[1].replace("&amp;", "&");
		var song_album = songDetails.match(album_regex)[1].replace("&amp;", "&");
		var file_pref = gpreferences.getCharPref(".filename");
		this.song_file = file_pref.replace("%artist%", song_artist)
									.replace("%title%", song_name)
										.replace("%album%", song_album) + ".mp3";
	},
	runFilePicker: function()
	{
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, "Save GrooveShredded File As...", nsIFilePicker.modeSave);
		fp.appendFilter("MP3 Files","*.mp3");
		fp.defaultString = this.song_file;
		var res = fp.show();
		if (res == nsIFilePicker.returnOK || res == nsIFilePicker.returnReplace){
			this.thefile = fp.file;
			this.obj_URI = this.ios.newURI(this.url, null, null);
			this.file_URI = this.ios.newFileURI(this.thefile);
			return true;
		}
		else return false;
	},
	saveSong: function()
	{
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
	}
};

function createButton(iden, times){
	$.ajax({
		url: 'http://grooveshark.com/more.php?getStreamKeyFromSongIDEx=',
		type: 'POST',
		data: iden,
		dataType: 'text',
		contentType: 'application/json',
		success: function(result) {
			// Repeat 10x to ensure fresh key
			if(times<10) createButton(iden, times+1);
			var element;
			var url_patt = /"ip":"(.*)"}/;
			var key_patt = /"streamKey":"(.*)",/;
			var stream_url = result.match(url_patt)[1];
			var stream_key = result.match(key_patt)[1];
			// Add a button to grooveshark
			element = content.document.getElementById("playerDetails_nowPlaying");
			$(element).children('b').remove();
			$(element).append('<b class="'+stream_key+'" style="\
								cursor:pointer; \
								color: #fff; \
								font-weight: normal; \
								margin-left: 10px; \
								padding: 2px 4px 2px 24px; \
								-moz-border-radius: 2px; \
								background: #888 url(chrome://grooveshredder/skin/shark-s.png) no-repeat 4px center;"> \
								Download Song</b>');
			$(element).children('b').click(function(){
				grooveDownloader.execute(stream_url, stream_key);
			});
			
			// Autodownload if preferred
			if(gpreferences.getBoolPref(".autoget") && times == 10){
				grooveDownloader.execute(stream_url, stream_key);
			}
		}
	});
}

function getPostData(subject){
	var dataStream = subject.QueryInterface(Components.interfaces.nsIUploadChannel).uploadStream;
	dataStream.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
	var stream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	stream.setInputStream(dataStream);
	var postBytes = stream.readByteArray(stream.available());
	var poststr = String.fromCharCode.apply(null, postBytes);
	dataStream.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
	var re = /{.*}/;
	return poststr.match(re)[0];
}

function newPostData(dataString){
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
}

window.addEventListener("load", function () { grooveshredder.onLoad(); }, false);