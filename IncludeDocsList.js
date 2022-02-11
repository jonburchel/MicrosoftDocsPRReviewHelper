function CheckboxChanged(e)
{
    if (e.target.id == "chkIncludeAll")
    {
        var i = 1;
        while (document.getElementById("chkIncludeFile" + i) != null)
        {
            var chk = document.getElementById("chkIncludeFile" + i);
            chk.checked = e.target.checked;
            i++;
        }
    }
    else
    {
        if (e.target.checked == false)
            document.getElementById("chkIncludeAll").checked = false;
        if (e.target.checked == true)
        {
            var i = 1;
            while (document.getElementById("chkIncludeFile" + i) != null)
            {
                var chk = document.getElementById("chkIncludeFile" + i);
                if (!chk.checked) 
                {
                    document.getElementById("chkIncludeAll").checked = false;
                    return;
                }
                i++;
            }
            document.getElementById("chkIncludeAll").checked = true;
        }
    }
}

const readLocalStorage = async (key) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], function (result) {
        if (result[key] === undefined) {
          resolve(null);
        } else {
          resolve(result[key]);
        }
      });
    });
};

var PRURL = location.search.replace("?PR=", "");
var PRNum = PRURL.substring(PRURL.indexOf("/pull/") + "/pull/".length);

///////////////////////////////////////////////////////////////
// BEGIN HTML PARSING OF BUILD STATUS IN PR AND BUILD REPORT //
///////////////////////////////////////////////////////////////

chrome.runtime.sendMessage({MsgType: "LoadPRPage", PRPageURL: PRURL}, async response => {
    var PRPage = document.createElement("html");
    PRPage.innerHTML = response.PRPage;

    var h3s = Array.from(PRPage.querySelectorAll('h3'));
    var i = 0;
    for (i = h3s.length - 1; i > 0; i--)
    {
        if (h3s[i].innerText.includes('Validation status:'))
            break;
    }
    
    if (i > 0)
    {
        var curRow = h3s[i].nextElementSibling.nextElementSibling
        while (curRow.innerText.indexOf("build report") == -1)
            curRow = curRow.nextElementSibling;
        var BuildReportUrl = curRow.firstElementChild.href;

        chrome.runtime.sendMessage({MsgType: "BuildReport", BuildReportUrl: BuildReportUrl}, async response => {
            var buildreport = document.createElement("html");
            buildreport.innerHTML = response.buildreport;
            
            var ValidatedFilesTable = buildreport.querySelector("a[name=\"ValidatedhFiles\"]")
            var Tables = buildreport.getElementsByTagName("table");
            for (var i = 0; i < Tables.length; i++)
            {
                if (ValidatedFilesTable.compareDocumentPosition(Tables[i]) == 4)
                {
                    ValidatedFilesTable = Tables[i];
                    i = Tables.length;
                }
            }
            
            var AllChecked = await readLocalStorage("AllFiles" + PRNum);
            if (AllChecked == null) 
                AllChecked = true;
            document.body.innerHTML += "<b>Choose articles for PR review from among those affected by this PR and click OK below:</b><br/><br/><input type=checkbox id=chkIncludeAll " + (AllChecked ? "checked" : "") + " /> Include all files<br/>"
            
            var fileNum = 1;
            for (var i = 1; i < ValidatedFilesTable.rows.length; i++)
            {
                var file = ValidatedFilesTable.rows[i].children[0].children[0].href;
                var href = ValidatedFilesTable.rows[i].children[2].children[0].href;
                if (file.indexOf("/articles/") != -1)
                    file = file.substring(file.indexOf("/articles/"));
                if (file.indexOf("/includes/") != -1)
                    file = file.substring(file.indexOf("/includes/"));
                var fileend = file.substring(file.lastIndexOf("."));
                if (fileend == ".md" || fileend == ".png")
                {
                    var FileChecked = await readLocalStorage("PR" + PRNum + "File" + file);
                    if (FileChecked == null)
                        FileChecked = true;
                    document.body.innerHTML += 
                    "<input type=checkbox " + (FileChecked ? "checked" : "") + " id=chkIncludeFile" + fileNum + " /> <a href='" + href + "'>" + file + "</a><br/>";              
                    fileNum++;
                }
            }
            document.body.innerHTML += "<br/><input type=button id=btnOK value='&nbsp;&nbsp;&nbsp;OK&nbsp;&nbsp;&nbsp;' /> <input type=button id=btnCancel value=Cancel />"
            document.getElementById("btnOK").addEventListener("click", ()=>{
                chrome.storage.local.set({["AllFiles" + PRNum]:(document.getElementById("chkIncludeAll").checked ? true : false)});
                var i = 1;
                while (document.getElementById("chkIncludeFile" + i) != null)
                {
                    var filename = document.getElementById("chkIncludeFile" + i).nextElementSibling.innerText;
                    chrome.storage.local.set({["PR" + PRNum + "File" + filename] : document.getElementById("chkIncludeFile" + i).checked})
                    i++;
                }
                window.close();
            });
            document.getElementById("btnCancel").addEventListener("click", ()=>{
                window.close();
            });
            document.getElementById("chkIncludeAll").addEventListener("change", CheckboxChanged);
            for(var i = 1; i < ValidatedFilesTable.rows.length; i++)
            {
                var file = ValidatedFilesTable.rows[i].children[0].children[0].href;
                var fileend = file.substring(file.lastIndexOf("."));
                if (fileend == ".md" || fileend == ".png")
                document.getElementById("chkIncludeFile" + i).addEventListener("change", CheckboxChanged);
            }
            return true;
        });
    }   
});                
/////////////////////////////////////////////////////////////
// END HTML PARSING OF BUILD STATUS IN PR AND BUILD REPORT //
/////////////////////////////////////////////////////////////