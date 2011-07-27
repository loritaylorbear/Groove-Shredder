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
	
	if($grooveShredderQuery('#checkautoget:checked').val() == undefined){
		$grooveShredderQuery('#autonext').val(false);
		$grooveShredderQuery('#checkautonext').attr('disabled', true);
	}
	
	$grooveShredderQuery('#checkautoget').click(function(){
		var $nxtchk = $grooveShredderQuery('#checkautonext');
		if($grooveShredderQuery('#checkautoget:checked').val() !== undefined){
			$grooveShredderQuery('#autonext').val($nxtchk.val());
			$nxtchk.attr('disabled', false);
		} else {
			$grooveShredderQuery('#autonext').val(false);
			$nxtchk.attr('disabled', true);
		}
	});
	
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
	
	$grooveShredderQuery.get('https://addons.mozilla.org/en-US/firefox/addon/grooveshredder/', function(data){
		var re = /<span class="version">([0-9.]+)<\/span>/i
		var version = re.exec(data)[1];
		var my_version = '1.13.1';
		if(version > my_version){
			$grooveShredderQuery('#abovecontainer .orange').css('display', 'block');
		} else if(version < my_version) {
			$grooveShredderQuery('#abovecontainer .grey').css('display', 'block');
		} else if(version == my_version){
			$grooveShredderQuery('#abovecontainer .green').css('display', 'block');;	
		}
	});
});
