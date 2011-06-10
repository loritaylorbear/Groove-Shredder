var $grooveShredderQuery = jQuery.noConflict();
var orgArgeeCodeGrooveShredder = {};

orgArgeeCodeGrooveShredder.pref_service = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
orgArgeeCodeGrooveShredder.gpreferences = orgArgeeCodeGrooveShredder.pref_service.getBranch("extensions.grooveshredder");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

$grooveShredderQuery(function(){
	var theApp = orgArgeeCodeGrooveShredder;

	if(!theApp.gpreferences.prefHasUserValue('.downloc')){
		var directory = FileUtils.getDir("Desk",[]);
		$grooveShredderQuery('#textdownloc').val(directory.path);
	}
	
	var directory = Components.classes["@mozilla.org/file/local;1"].
						createInstance(Components.interfaces.nsILocalFile);
	directory.initWithPath($grooveShredderQuery('#textdownloc').val());
	
	$grooveShredderQuery('#btndownloc').click(function(){
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, "Select Groove Shredder Download Location", nsIFilePicker.modeGetFolder);
		fp.displayDirectory = directory;
		var res = fp.show();
		if (res == nsIFilePicker.returnOK || res == nsIFilePicker.returnReplace){
			$grooveShredderQuery('#textdownloc').val(fp.file.path);
			$grooveShredderQuery('#downloc').val(fp.file.path);
		}
	});
	
	$grooveShredderQuery('#dropdowndir').bind('command', function(event){
		$grooveShredderQuery('#downdir').val(event.target.value);
	});
});