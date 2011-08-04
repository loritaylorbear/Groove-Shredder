/* Declaring namespaces to prevent conflicts */
var $grooveShredderQuery = jQuery.noConflict();
var orgArgeeCodeGrooveShredder = {};

/* Global Variables contained in the namespace */
orgArgeeCodeGrooveShredder.pref_service = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
orgArgeeCodeGrooveShredder.gpreferences = orgArgeeCodeGrooveShredder.pref_service.getBranch("extensions.grooveshredder");

/**
 * grooveshredder
 * 
 * Manages the request observer and toolbar actions.
 **/
orgArgeeCodeGrooveShredder.grooveshredder = {
	/**
	* This runs every time Firefox starts.
	**/
	onLoad: function() {
		// Check whether Groove Shredder is enabled.
		if(this.theApp.gpreferences.prefHasUserValue("enabled")){
			if(this.theApp.gpreferences.getBoolPref("enabled")){
				// Register observer.
				this.setEnabled();
			} else {
				// No observer was ever added, style button.
				var btn = document.getElementById("grooveshredder-toolbar-button");
				if(btn !== null)
					btn.setAttribute("class","grooveshredder-tbutton-off toolbarbutton-1 chromeclass-toolbar-additional");
			}
		} else {
			// If the preference is blank, enable.
			this.setEnabled();
		}
	},
	/**
	* Handle toolbar button behavior.
	**/
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
	/**
	* Register the observer and stylize the button.
	**/
	setEnabled: function() {
		var btn = document.getElementById("grooveshredder-toolbar-button");
		this.initialized = true;
		this.theApp.gpreferences.setBoolPref("enabled", true);
		this.theApp.grooveRequestObserver.register();
		if(btn !== null)
			btn.setAttribute("class","grooveshredder-tbutton-on toolbarbutton-1 chromeclass-toolbar-additional");	
	},
	/**
	* Unregister the observer and stylize the button.
	**/
	setDisabled: function() {
		var btn = document.getElementById("grooveshredder-toolbar-button");
		this.initialized = false;
		this.theApp.gpreferences.setBoolPref("enabled", false);
		this.theApp.grooveRequestObserver.unregister();
		btn.setAttribute("class","grooveshredder-tbutton-off toolbarbutton-1 chromeclass-toolbar-additional");
	},
	theApp : orgArgeeCodeGrooveShredder
};

/**
 * grooveRequestObserver
 * 
 * The HTTP Listener that monitors all outgoing requests.
 **/
orgArgeeCodeGrooveShredder.grooveRequestObserver = 
{
	/**
	 * This function observes all requests and performs the appropriate
	 * actions when an event useful to us is detected.
	 **/
	observe: function(subject, topic, data)
	{
		if(typeof(Components) !== 'undefined'){
			// This URL indicates that a new connection is being established
			var token_url = /^https?:\/\/grooveshark\.com\/more\.php\?getCommunicationToken$/;
			// A URL of this format indicates that a song is being played
			var song_url = /^http:\/\/grooveshark\.com\/more\.php\?getStreamKeyFromSongIDEx$/;

			// Obtain the HTTP channel from the observed subject
			var channel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);

			// Perform the actions appropriate to the event
			if(channel.URI.spec.match(token_url)){
				// Simple toggle to prevent two requests for the price of one
				this.originalTkn = this.originalTkn? false : true;
				if(this.originalTkn)
					// If we already have a Grooveshark tab, alert user
					if(typeof this.theApp.browser !== "undefined")
						alert("Groove Shredder will no longer work with " +
							  "the older Grooveshark tab.");
				// Grooveshark was opened in this tab, remember the tab
				var notificationCallbacks = channel.notificationCallbacks;
				var domWin = notificationCallbacks.getInterface(Components.interfaces.nsIDOMWindow);
				this.theApp.browser = gBrowser.getBrowserForDocument(domWin.top.document);
				// Kill old stream key data
				delete this.theApp.streamKeyData;
				// Attach a DOM change listener to the page
				this.theApp.browser.contentDocument
								   .addEventListener("DOMNodeInserted",
										 			 this.theApp.utility.domChanged,
										 			 false);
			} else if(channel.URI.spec.match(song_url)){
				// Create the "Download Song" button using the posted data
				this.theApp.utility.preSongButton(this.theApp.utility.getPostData(subject));
			} else {
				// If no special URL matched, we check for any Grooveshark
				// related request and add the options link
				var re = /http:\/\/grooveshark.com\/.*$/;
				if(channel.URI.spec.match(re)){
					this.theApp.utility.addOptionsLink();
				}
			}
		}
	},
	/**
	 * Accessor to fetch the observer service
	 **/
	get observerService() {
		return Components.classes["@mozilla.org/observer-service;1"]
						 .getService(Components.interfaces.nsIObserverService);
	},
	/**
	 * Register the observer (attach it to Firefox)
	 **/
	register: function()
	{
		this.original = true;
		this.observerService.addObserver(this, "http-on-modify-request", false);
	},
	/**
	 * Unregister the observer (detach it from Firefox)
	 **/
	unregister: function()
	{
		this.observerService.removeObserver(this, "http-on-modify-request");
	},
	theApp : orgArgeeCodeGrooveShredder
};

/**
 * grooveDownloader
 *
 * Handles most of the download logic exclusively.
 **/
orgArgeeCodeGrooveShredder.grooveDownloader = 
{
	/**
	 * Initializes the downloader, giving it the postdata and the URL it
	 * will need in order to be able to access the song.
	 **/
	init: function(url, dataString) {
		this.ios = Components.classes['@mozilla.org/network/io-service;1']
						.getService(Components.interfaces.nsIIOService);
		this.persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                        .createInstance(Components.interfaces.nsIWebBrowserPersist);
		this.xfer = Components.classes["@mozilla.org/transfer;1"].createInstance(Components.interfaces.nsITransfer);
		
		this.url = 'http://'+url+'/stream.php';
		this.data = this.theApp.utility.newPostData(dataString);
	},
	/**
	 * Fetches the details of the current song being played and converts
	 * them into a file name.
	 **/
	getFileName: function()
	{
		var songBox = this.theApp.browser.contentDocument.getElementById("playerDetails_nowPlaying");
		var song_name = $grooveShredderQuery(songBox).find('.currentSongLink').attr('title');
		var song_artist = $grooveShredderQuery(songBox).find('.artist').attr('title');
		var song_album = $grooveShredderQuery(songBox).find('.album').attr('title');
		this.parseFileName(song_name, song_artist, song_album);
	},
	/**
	 * Uses the file name preference to create the file name given details
	 * about the song.
	 **/
	parseFileName: function(song_name, song_artist, song_album)
	{
		var file_pref = this.theApp.gpreferences.getCharPref(".filename");
		this.theApp.song_name = song_name;
		this.theApp.song_artist = song_artist;
		this.theApp.song_album = song_album;
		this.song_file = this.theApp.utility.replaceTags(file_pref) + ".mp3";
		return this.song_file;
	},
	/**
	 * Deals with creating the directory where the file is saved as well
	 * as the file save dialog box. The directory is removed if the dialog
	 * is canceled.
	 **/
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
	/**
	 * Begins the actual download, as well as attaching it to the download
	 * manager through a progress listener.
	 **/
	saveSong: function()
	{
		var dbutton = this.theApp.browser.contentDocument.getElementById("playerDetails_grooveShredder");
		$grooveShredderQuery(dbutton).fadeTo("slow",0.25).unbind('click').click(function(){alert('Please re-add song to queue to download again');});
		this.xfer.init(this.obj_URI, this.file_URI, "", null, null, null, this.persist);
		this.persist.progressListener = this.xfer; 
		this.persist.saveURI(this.obj_URI, null, null, this.data, "", this.thefile);	
	},
	/**
	 * This function is the main entry point for this class - it takes
	 * in the parameters required to handle the download and utilizes sibling
	 * functions to complete the task.
	 **/
	execute: function(url, data, filename)
	{
		this.init(url, data);
		if(filename.length == 0){
			this.getFileName();
		} else {
			this.song_file = filename;
		}
		if(this.runFilePicker()){
			this.saveSong();
		}
	},
	theApp : orgArgeeCodeGrooveShredder
};

/**
 * utility
 *
 * Provides utility functions used throughout the extension, as well
 * as performing most of the communication with Grooveshark.
 **/
orgArgeeCodeGrooveShredder.utility = 
{
	/**
	 * When the DOM has changed, this function investigates the changes
	 * and appends controls accordingly.
	 **/
	domChanged: function(event){
		var theApp = orgArgeeCodeGrooveShredder;
		if($grooveShredderQuery(event.target).hasClass('jj_menu_item_play_last')){
			theApp.utility.appendContextButton(event.target);
		} else if($grooveShredderQuery(event.target)
					.attr('id') == "page_header"){
			theApp.utility.appendListButton(event.target);
		}
	},
	/**
	 * When a selection is right clicked, a "Download Selected" button
	 * will be appended to the Grooveshark context menu.
	 **/
	appendContextButton: function(menuItem){
		var theApp = orgArgeeCodeGrooveShredder;
		var downItem = '<div id="gs_menu_item" class="jj_menu_item jj_menu_item_hasIcon">\
						<span class="icon"></span>\
						<span class="more"></span>\
						<span class="jj_menu_item_text" title="Download Selected">\
						Download Selected\
						</span></div>';
		$grooveShredderQuery(menuItem).after(downItem);
		var element = theApp.browser.contentDocument.getElementById("gs_menu_item");
		$grooveShredderQuery(element).click(theApp.utility.handleContextButton);
	},
	/**
	 * Create the "Download Playlist" button and append it to the page.
	 * This function also attaches a listener to the sidebar for persistence.
	 **/
	appendListButton: function(pageHeader){
		var theApp = orgArgeeCodeGrooveShredder;
		$grooveShredderQuery(pageHeader)
			.find('h3')	
				.after('<b id="playlistName_grooveShredder"> \
						Download All</b>');
		$grooveShredderQuery(pageHeader)
			.find('#playlistName_grooveShredder')
				.click(theApp.utility.handleListButton);
	},
	/**
	 * Uses jQuery to figure out which items are selected as well as song
	 * details, then initiates downloads.
	 **/
	handleContextButton: function(event){
		var theApp = orgArgeeCodeGrooveShredder;
		if(typeof theApp.streamKeyData === "undefined"){
			alert("You must play at least one song prior to using this button.");
			return false;
		} else if(!theApp.gpreferences.getBoolPref(".nodupeprompt")
					|| !theApp.gpreferences.getBoolPref(".nodialog")){
			// Warn the user, too many dialogs spell disaster
			if(!confirm('It is HIGHLY recommended to turn off duplicate file prompts,\r\n' +
						'as well as skipping the file select dialog.\r\n' +
						'Do you still want to Continue?')) return false;
		}
		var element = theApp.browser.contentDocument.getElementById("grid");
		// Use a timer to download incrementally
		var timer = 0;
		$grooveShredderQuery(element).find('.slick-row.selected').each(function(){
			theApp.utility.preMultiButton(this, timer);
			timer += 1000;
		});
	},
	/**
	 * Uses jQuery to find all items in the current list, then initiates
	 * downloads.
	 **/
	handleListButton: function(event){
		var theApp = orgArgeeCodeGrooveShredder;
		if(typeof theApp.streamKeyData === "undefined"){
			alert("You must play at least one song prior to using this button.");
			return false;
		} else if(!theApp.gpreferences.getBoolPref(".nodupeprompt")
					|| !theApp.gpreferences.getBoolPref(".nodialog")){
			// Warn the user, too many dialogs spell disaster
			if(!confirm('It is HIGHLY recommended to turn off duplicate file prompts,\r\n' +
						'as well as skipping the file select dialog.\r\n' +
						'Do you still want to Continue?')) return false;
		}
		var element = theApp.browser.contentDocument.getElementById("grid");
		// Use a timer to download incrementally
		var timer = 0;
		$grooveShredderQuery(element).find('.slick-row').each(function(){
			theApp.utility.preMultiButton(this, timer);
			timer += 1000;
		});
	},
	/**
	 * Handles fetching the file name and executing download.
	 **/
	preMultiButton: function(element, timer){
		var theApp = orgArgeeCodeGrooveShredder;
		// Strip out the song's details
		var songId = $grooveShredderQuery(element).find(".play").attr('rel');
		var songName = $grooveShredderQuery(element).find(".songLink").html();
		var songAlbum = $grooveShredderQuery(element).find(".album > a").html();
		var songArtist = $grooveShredderQuery(element).find(".artist > a").html();
		var songFile = theApp.grooveDownloader.parseFileName(songName, songArtist, songAlbum);
		// Fetch the stream key and execute download
		setTimeout(function(){
			theApp.utility.getStreamKey(songId, theApp.utility.runMultiButton, songFile, 0);
		},timer);
	},
	/**
	 * This function must exist as a workaround for scope.
	 **/
	runMultiButton: function(url, key, filename){
		orgArgeeCodeGrooveShredder.grooveDownloader.execute(url, key, filename);
	},
	/**
	 * Perform the functions that must take place before the "Download Song"
	 * button is actually appended.
	 **/
	preSongButton: function(postdata){
		var theApp = orgArgeeCodeGrooveShredder;
		// Store the POST data for re-use
		theApp.streamKeyData = postdata;
		// Call getStreamKey multiple times to ensure fresh key
		theApp.utility.getStreamKey(0, theApp.utility.addSongButton, true, 5);
	},
	/**
	 * Add the "Download Song" button, and initiate the download if user
	 * preferences allow.
	 **/
	addSongButton: function(stream_url, stream_key, last_call){
		var theApp = orgArgeeCodeGrooveShredder;
		if(last_call){
			var element;	
			// Add a button to grooveshark
			element = theApp.browser.contentDocument.getElementById("playerDetails_nowPlaying");
			$grooveShredderQuery(element).children('b').remove();
			$grooveShredderQuery(element).append('<b id="playerDetails_grooveShredder"> \
													Download Song</b>');
			$grooveShredderQuery(element).children('b').click(function(){
				theApp.grooveDownloader.execute(stream_url, stream_key, "");
			});
			// Autodownload if preferred
			if(theApp.gpreferences.getBoolPref(".autoget") && last_call){
				// Download the song automagically
				theApp.grooveDownloader.execute(stream_url, stream_key, "");
				// Skip to next song if preferred
				if(theApp.gpreferences.getBoolPref(".autonext")){
					theApp.browser.contentDocument.getElementById("player_next").click();
				}
			}
		}
	},
	/**
	 * Create the 'options' link and append it to the page.
	 **/
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
	/**
	 * Given a song ID, get a stream key from Grooveshark.
	 **/
	getStreamKey: function(song_id, callback, params, times){
		var theApp = orgArgeeCodeGrooveShredder;
		var postdata = theApp.streamKeyData;
		if(song_id != 0) postdata = postdata.replace(/"songID":[0-9]+/g,
													 '"songID":'+song_id);
		$grooveShredderQuery.ajax({
			url: 'http://grooveshark.com/more.php?getStreamKeyFromSongIDEx=',
			type: 'POST',
			data: postdata,
			dataType: 'text',
			contentType: 'application/json',
			success: function(result) {
				result = $grooveShredderQuery.parseJSON(result);
				if(times == 0)
					callback(result.result.ip, result.result.streamKey, params);
				else
					theApp.utility.getStreamKey(song_id, callback, params, times-1);
			}
		});
	},
	/**
	 * Extract the plaintext POST data from a given subject.
	 **/
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
	/**
	 * Create the POST data input stream from plaintext.
	 **/
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
	/**
	 * Replace tags %artist%, %title% and %album% with values, as well as
	 * sanitizing the file or directory name.
	 **/
	replaceTags: function(original){
		return original.replace("%artist%", this.theApp.song_artist)
							.replace("%title%", this.theApp.song_name)
								.replace("%album%", this.theApp.song_album)
									.replace(/[\#%&\*:<>\?\/\\\{\|\}\.]/g,"");
	},
	/**
	 * Return the final directory based on set preferences.
	 **/
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
					subdir = $grooveShredderQuery(playDetails).find('h3').html();
					subdir = subdir.replace(/<span .*>[a-zA-Z]+<\/span>:/gi,"Search -");
					subdir = subdir.replace(/<[^>]+>/g,"");
				}
				if(subdir != null) {
					// Sanitize and append
					subdir = subdir.replace(/^\s+|\s+$/g,"").replace(/[\#%&\*:<>\?\/\\\{\|\}\.]/g,"");
					directory.appendRelativePath(subdir);
				}
			}
		} else if(this.theApp.gpreferences.prefHasUserValue('.downdir')){
			var dir_pref = this.theApp.gpreferences.getCharPref(".downdir");
			var subdir = this.theApp.utility.replaceTags(dir_pref);
			directory.appendRelativePath(subdir);
		}
		
		// Deal with second sub-directory option
		if(this.theApp.gpreferences.prefHasUserValue('.subdowndir')){
			var dir_pref = this.theApp.gpreferences.getCharPref(".subdowndir");
			var subdir = this.theApp.utility.replaceTags(dir_pref);
			directory.appendRelativePath(subdir);
		}
		
		return directory;
	},
	theApp : orgArgeeCodeGrooveShredder
}

window.addEventListener("load", function () { orgArgeeCodeGrooveShredder.grooveshredder.onLoad(); }, false);
