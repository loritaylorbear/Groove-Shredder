/* Declaring namespace to prevent conflicts */
var orgArgeeCodeGrooveShredder = {};

/* Drop jQuery into the namespace like a heavy rock */
orgArgeeCodeGrooveShredder.$ = jQuery.noConflict();

/* Global Variables contained in the namespace */
// orgArgeeCodeGrooveShredder.console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
orgArgeeCodeGrooveShredder.download_manager = Components.classes["@mozilla.org/download-manager;1"].getService(Components.interfaces.nsIDownloadManager);
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
		// Set up an object to fetch localized strings.
		this.theApp.localize = document.getElementById("grooveshredder-strings");
		// Set up an empty download queue.
		this.theApp.toBeDownloaded = new Array();
		// Attach our download listener.
		this.theApp.download_manager.addListener(this.theApp.grooveQueueListener);
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
			this.theApp.utility.showNotify('disabledString');
		} else {
			this.setEnabled();
			this.theApp.utility.showNotify('enabledString');
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
						this.theApp.utility.showNotify('onlyNewTab');
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
				this.theApp.utility.addSongButton(this.theApp.utility.getPostData(subject));
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
		this.xfer = Components.classes["@mozilla.org/transfer;1"]
						.createInstance(Components.interfaces.nsITransfer);
		
		this.url = 'http://'+url+'/stream.php';
		this.data = this.theApp.utility.newPostData(dataString);
	},
	/**
	 * Deals with creating the directory where the file is saved as well
	 * as the file save dialog box. The directory is removed if the dialog
	 * is canceled.
	 **/
	runFilePicker: function()
	{
		var automade = false;
		var directory = this.theApp.fileUtilities.getDirectory();
		if(!directory.exists()){
			directory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
			automade = true;
		}
		if(!this.theApp.gpreferences.getBoolPref(".nodialog")){
			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window, this.theApp.localize.getString('saveTitle'), nsIFilePicker.modeSave);
			fp.appendFilter(this.theApp.localize.getString('mp3files'),"*.mp3");
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
				if(!confirm(this.song_file+'\r\n'+
							this.theApp.localize.getString('overPrompt'))) return false;
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
		this.xfer.init(this.obj_URI, this.file_URI, "", null, null, null, this.persist);
		this.persist.progressListener = this.xfer;
		this.persist.saveURI(this.obj_URI, null, null, this.data, "", this.thefile);	
	},
	/**
	 * Adds a particular song download to the queue.
	 **/
	addDownload: function(song_id, filename, times)
	{
		orgArgeeCodeGrooveShredder.toBeDownloaded.push([song_id, filename, times]);
		orgArgeeCodeGrooveShredder.grooveDownloader.runDownloads();
	},
	/**
	 * Run as many downloads as possible at all times.
	 **/
	runDownloads: function()
	{
		var maxdl = this.theApp.gpreferences.getIntPref('.concurrnum');
		while(this.theApp.toBeDownloaded.length > 0
			  && this.theApp.download_manager.activeDownloadCount < maxdl){
			var item = this.theApp.toBeDownloaded.shift();
			this.getStreamKeyAndSave(item[0], item[1], item[2]);
		}
	},
	/**
	 * Given a song ID, get a stream key from Grooveshark.
	 **/
	getStreamKeyAndSave: function(song_id, filename, times){
		var theApp = orgArgeeCodeGrooveShredder;
		var postdata = theApp.streamKeyData;
		if(song_id != 0) postdata = postdata.replace(/"songID":[0-9]+/g,
													 '"songID":'+song_id);
		var staleKey = JSON.parse(theApp.streamKeyData);
		theApp.$.ajax({
			url: 'http://grooveshark.com/more.php?getStreamKeyFromSongIDEx=',
			type: 'POST',
			data: postdata,
			dataType: 'text',
			contentType: 'application/json',
			success: function(result) {
				result = JSON.parse(result);
				if(times == 0)
					theApp.grooveDownloader.execute(result.result.ip, result.result.streamKey, filename);
				else
					theApp.grooveDownloader.getStreamKeyAndSave(song_id, filename, times-1);
			}
		});
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
			this.song_file = this.theApp.fileUtilities.getFileName();
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
 * fileUtilities
 *
 * Performs utility functions related to files and directories.
 **/
orgArgeeCodeGrooveShredder.fileUtilities = 
{
	/**
	 * Fetches the details of the current song being played and converts
	 * them into a file name.
	 **/
	getFileName: function()
	{
		var theApp = orgArgeeCodeGrooveShredder;
		var songBox = theApp.browser.contentDocument.getElementById("playerDetails_nowPlaying");
		var song_name = theApp.$(songBox).find('.currentSongLink').attr('title');
		var song_artist = theApp.$(songBox).find('.artist').attr('title');
		var song_album = theApp.$(songBox).find('.album').attr('title');
		return theApp.fileUtilities.parseFileName(song_name, song_artist, song_album);
	},
	/**
	 * Uses the file name preference to create the file name given details
	 * about the song.
	 **/
	parseFileName: function(song_name, song_artist, song_album)
	{
		var theApp = orgArgeeCodeGrooveShredder;
		var file_pref = theApp.gpreferences.getCharPref(".filename");
		theApp.song_name = song_name;
		theApp.song_artist = song_artist;
		theApp.song_album = song_album;
		var song_file = theApp.fileUtilities.replaceTags(file_pref) + ".mp3";
		return song_file;
	},
	/**
	 * Replace tags %artist%, %title% and %album% with values, as well as
	 * sanitizing the file or directory name.
	 **/
	replaceTags: function(original){
		var theApp = orgArgeeCodeGrooveShredder;
		return original.replace("%artist%", theApp.song_artist)
							.replace("%title%", theApp.song_name)
								.replace("%album%", theApp.song_album)
									.replace(/[\#%&\*:<>\?\/\\\{\|\}\.]/g,"");
	},
	/**
	 * Return the final directory based on set preferences.
	 **/
	getDirectory: function(){
		var theApp = orgArgeeCodeGrooveShredder;
		var directory;
		Components.utils.import("resource://gre/modules/FileUtils.jsm");
		if(!theApp.gpreferences.prefHasUserValue('.downloc')){
			directory = FileUtils.getDir("Desk", []);
		} else {
			var dir = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
			dir.initWithPath(decodeURIComponent(escape(theApp.gpreferences.getCharPref('.downloc'))));
			directory = dir;
		}
		
		if(theApp.gpreferences.getBoolPref('.playdir')){
			var playDetails = theApp.browser.contentDocument.getElementById("page_header");
			var subdir = theApp.$(playDetails).find('.name').html();
			if(typeof(subdir) !== undefined){
				if(subdir == null) {
					subdir = theApp.$(playDetails).find('h3').html();
					subdir = subdir.replace(/<span .*>[a-zA-Z]+<\/span>:/gi,"Search -");
					subdir = subdir.replace(/<[^>]+>/g,"");
				}
				if(subdir != null) {
					// Sanitize and append
					subdir = subdir.replace(/^\s+|\s+$/g,"").replace(/[\#%&\*:<>\?\/\\\{\|\}\.]/g,"");
					directory.appendRelativePath(subdir);
				}
			}
		} else if(theApp.gpreferences.prefHasUserValue('.downdir')){
			var dir_pref = theApp.gpreferences.getCharPref(".downdir");
			var subdir = theApp.fileUtilities.replaceTags(dir_pref);
			directory.appendRelativePath(decodeURIComponent(escape(subdir)));
		}
		
		// Deal with second sub-directory option
		if(theApp.gpreferences.prefHasUserValue('.subdowndir')){
			var dir_pref = theApp.gpreferences.getCharPref(".subdowndir");
			var subdir = theApp.fileUtilities.replaceTags(dir_pref);
			directory.appendRelativePath(decodeURIComponent(escape(subdir)));
		}	
		return directory;
	}
}
 
/**
 * grooveQueueListener
 *
 * A web progress listener that keeps an eye on download status. Helps
 * to enforce the limit on concurrent downloads.
 **/
orgArgeeCodeGrooveShredder.grooveQueueListener =
{
	onProgressChange: function(a, b, c, d, e, f){},
	onSecurityChange: function(a, b, c){},
	onDownloadStateChange: function(a, b){},
	onStateChange: function(a, b, c, d){
		if(c & Components.interfaces.nsIWebProgressListener.STATE_STOP){
			var theApp = orgArgeeCodeGrooveShredder;
			theApp.grooveDownloader.runDownloads();
		}
	}
}

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
		if(theApp.$(event.target)
				 .hasClass('jj_menu_item_play_last')){
			// Append a context button to the right click menu
			theApp.utility.appendContextButton(event.target);
		} else if(theApp.$(event.target)
				  .hasClass('slick-row') && theApp.recordSongs){
			// Store all seen songs in a DOM element
			theApp.utility.appendSongItem(event.target);
			theApp.$(event.target).click(function(){
				// If this item is selected or deselected, re-append
				theApp.utility.appendSongItem(this);
			});
		} else if(typeof theApp.streamKeyData !== "undefined" &&
				  theApp.$(event.target).hasClass('currentSongLink')){
			// Deal with disappearing button bug
			theApp.utility.addSongButton(theApp.streamKeyData);
		}
	},
	/**
	 * Append every song that is loaded to a temporary container. This
	 * is done because we are otherwise unable to see every song in a
	 * playlist or search.
	 **/
	appendSongItem: function(songItem){
		var theApp = orgArgeeCodeGrooveShredder;
		var newSong = theApp.$(songItem).clone();
		var element = theApp.browser.contentDocument.getElementById("grid");
		// Get song ID and convert to get unique ID
		var songId = theApp.$(newSong).find('.play').attr('rel');
		if(typeof songId !== "undefined"){
			theApp.$(newSong).removeClass('slick-row')
										 .addClass('groovy-row')
										 .attr('id', "rel-"+songId);
			// Remove this song if it was added previously
			theApp.$(element).find("#rel-"+songId).remove();
			// Add song to temporary container
			theApp.$(element).find(".slick-header-secondary").append(newSong);
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
		theApp.$(menuItem).after(downItem);
		var element = theApp.browser.contentDocument.getElementById("gs_menu_item");
		theApp.$(element).click(theApp.utility.handleContextButton);
	},
	/**
	 * Handles fetching the file name and executing download.
	 **/
	handleContextButton: function(){
		var theApp = orgArgeeCodeGrooveShredder;
		if(typeof theApp.streamKeyData === "undefined"){
			theApp.utility.showNotify('playFirst');
			return false;
		} else if(!theApp.gpreferences.getBoolPref(".nodupeprompt")
					|| !theApp.gpreferences.getBoolPref(".nodialog")){
			// Warn the user, too many dialogs spell disaster
			if(!confirm(theApp.localize.getString('multiWarn'))) return false;
		}
		theApp.$('body',theApp.browser.contentDocument)
			.append('<div id="groove-blocker"></div>');
		// Show a message to the user
		theApp.utility.showNotify('scanningSongs');
		// Start recording song rows
		theApp.recordSongs = true;
		var element = theApp.$('.slick-viewport',theApp.browser.contentDocument)[0];
		// Paste the songs we already have
		theApp.$(element).find('.slick-row.selected')
									 .each(function(){
											theApp.utility.appendSongItem(this);
										   });
		// Scroll down and up to find selected songs
		theApp.$(element)
			.scrollTop(0)
			.animate({scrollTop: element.scrollHeight},
					 {duration: element.scrollHeight*2})
			.animate({scrollTop: 0},
					 {duration: element.scrollHeight*2});
		setTimeout(function(){
			theApp.utility.downloadAllSelected();
		}, element.scrollHeight*4+500);
	},
	/**
	 * Downloads everything we found to be selected.
	 **/
	downloadAllSelected: function(){
		var timer = 0;
		var theApp = orgArgeeCodeGrooveShredder;
		// Stop recording songs
		theApp.recordSongs = false;
		theApp.$('#groove-blocker',theApp.browser.contentDocument)
			.remove();
		var element = theApp.browser.contentDocument.getElementById("grid");
		var tempArray = theApp.$(element).find('.groovy-row.selected');
		// Show a message to the user
		theApp.utility.showNotify(tempArray.length+" ",'willDownload');
		// Iterate over all selected songs
		theApp.$(tempArray).each(function(){
			// Strip out the song's details
			var songId = theApp.$(this).find(".play").attr('rel');
			var songName = theApp.$(this).find(".songLink").html();
			var songAlbum = theApp.$(this).find(".album > a").html();
			var songArtist = theApp.$(this).find(".artist > a").html();
			var songFile = theApp.fileUtilities.parseFileName(songName, songArtist, songAlbum);

			// Fetch the stream key and execute download
			setTimeout(function(){
				theApp.grooveDownloader.addDownload(songId, songFile, 0);
			},timer);
			timer += 1000;
		});
	},
	/**
	 * Add the "Download Song" button, and initiate the download if user
	 * preferences allow.
	 **/
	addSongButton: function(postdata){
		var theApp = orgArgeeCodeGrooveShredder;
		// Store the POST data for re-use
		theApp.streamKeyData = postdata;
		// Add a button to grooveshark
		var element = theApp.browser.contentDocument.getElementById("playerDetails_nowPlaying");
		theApp.$(element).children('b').remove();
		theApp.$(element).append('<b id="playerDetails_grooveShredder"> \
												Download Song</b>');
		theApp.$(element).children('b').click(function(){
			theApp.grooveDownloader.getStreamKeyAndSave(0, "", 5);
		});
		// Autodownload if preferred
		if(theApp.gpreferences.getBoolPref(".autoget")){
			// Download the song automagically
			theApp.grooveDownloader.getStreamKeyAndSave(0, "", 5);
			// Skip to next song if preferred
			if(theApp.gpreferences.getBoolPref(".autonext")){
				theApp.browser.contentDocument.getElementById("player_next").click();
			}
		}
	},
	/**
	 * Create the 'options' link and append it to the page.
	 **/
	addOptionsLink: function(){
		var theApp = orgArgeeCodeGrooveShredder;
		// At the moment this function adds both CSS and the options link
		var topBar = gBrowser.contentDocument.getElementById("header");
		if(theApp.$(topBar).find('#grooveshark').size() > 0
				&& theApp.$(topBar).find('#gs-options-link').size() == 0){
			theApp.$(topBar).append('<a id="gs-options-link"> \
													Groove Shredder Options</a>');
			var headElement = gBrowser.contentDocument.getElementsByTagName("head")[0];
			theApp.$(headElement).append('<link rel="stylesheet" type="text/css" \
														href="resource://grooveshredder/page.css"/>');
			// Add the event to make things work
			theApp.$(topBar).find('#gs-options-link').click(function(){
				window.open("chrome://grooveshredder/content/options.xul", 
							theApp.localize.getString('prefsTitle'),
							"chrome, centerscreen");
			});
		}
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
	 * Show a notification to the user based on the given string.
	 **/
	showNotify: function(pre,stringName,post){
		var theApp = orgArgeeCodeGrooveShredder;
		// Make pre and post optional
		if(typeof stringName === "undefined"){
			stringName = pre;
			pre = "";
		}
		if(typeof post === "undefined")
			post = "";
		// Create the HTML for the notification (static HTML)
		var notification = '\
		<li class="notification notification_success shredded" style="top: 100px">\
			<div class="top">\
			<div class="cap right"></div>\
			<div class="cap left"></div>\
			<div class="center"></div>\
			</div>\
			<div class="middle">\
				<div class="cap right"></div>\
				<div class="cap left"></div>\
				<div class="content favorited">\
					<p></p>\
					<div class="actions clear">\
					</div>\
					<a class="close"><span data-translate-text="CLOSE">???</span></a>\
					<div class="clear"></div>\
				</div>\
			</div>\
			<div class="bottom">\
			<div class="cap right"></div>\
			<div class="cap left"></div>\
			<div class="center"></div>\
		</div>\
		</li>\
		';
		// Is a notification area available?
		if(theApp.$("ul#notifications",
					theApp.browser.contentDocument)
					.length == 0){
			// No place to put notification. Fallback to alert.
			alert(pre+theApp.localize.getString(stringName)+post);
		} else {
			// Attach the blank notification to the page
			theApp.$("ul#notifications",theApp.browser.contentDocument)
				  .prepend(notification);
			// Insert magical text into the notification
			theApp.$("li.shredded:first",theApp.browser.contentDocument).find('p')
				  .text(pre+theApp.localize.getString(stringName)+post);
			// Slide the notification up, wait, then slide out
			theApp.$("li.shredded:first",theApp.browser.contentDocument)
				  .animate({top: '0px'}, 300, "linear")
				  .delay(6000)
				  .animate({top: '100px'}, {"duration": 300, "complete":function(){
					theApp.$(this).remove();
				  }});
		}
	},
	theApp : orgArgeeCodeGrooveShredder
}

window.addEventListener("load", function () { orgArgeeCodeGrooveShredder.grooveshredder.onLoad(); }, false);
