//suitelet

function mainApp(request, response) {
    var context = nlapiGetContext();
    if (request.getMethod() == 'GET') {
        var form_FS = nlapiCreateForm(nlapiLoadConfiguration('companyinformation').getFieldValue('legalname') + ' Income Statement');
        form_FS.addFieldGroup('custpage_form_header', 'Select Start And End Dates');
        var stDate = form_FS.addField('custpage_startdate', 'select', 'Start Date', null, 'custpage_form_header').setMandatory(true);
        stDate.addSelectOption('', '', true);
        var endDate = form_FS.addField('custpage_enddate', 'select', 'End Date', null, 'custpage_form_header').setMandatory(true);
        endDate.addSelectOption('', '', true);
        var accountingperiodSearch = nlapiSearchRecord('accountingperiod', null,
            [
                ['isquarter', 'is', 'F'],
                'AND',
                ['isyear', 'is', 'F'],
                'AND',
                ['enddate', 'onorbefore', 'today'],
                'AND',
                ['isadjust', 'is', 'F']
            ],
            [
                new nlobjSearchColumn('internalid'),
                new nlobjSearchColumn('startdate'),
                new nlobjSearchColumn('enddate').setSort(true),
                new nlobjSearchColumn('periodname')
            ]
        );
        for (var i = 0; i < accountingperiodSearch.length; i++) {
            stDate.addSelectOption(accountingperiodSearch[i].getValue('internalid'), accountingperiodSearch[i].getValue('startdate'));
            endDate.addSelectOption(accountingperiodSearch[i].getValue('internalid'), accountingperiodSearch[i].getValue('enddate'));
        }
        form_FS.addFieldGroup('custpage_params', 'Available Filters');
        form_FS.addField('custpage_dept_select', 'select', 'Division', 'department', 'custpage_params');
        form_FS.addSubmitButton('Run');
        response.writePage(form_FS);
    } else {
        var startDate = Number(request.getParameter('custpage_startdate'));
        var endDate = Number(request.getParameter('custpage_enddate'));
        var endText = request.getParameter('inpt_custpage_enddate');
        var divFilter = Number(request.getParameter('custpage_dept_select')) || '';
        var accountingperiodSearch = nlapiSearchRecord('accountingperiod', null,
            [
                ['isquarter', 'is', 'F'],
                'AND',
                ['isyear', 'is', 'F'],
                'AND',
                ['enddate', 'onorbefore', 'today'],
                'AND',
                ['isadjust', 'is', 'F'],
                'AND',
                ['internalidnumber', 'between', startDate, endDate]
            ],
            [
                new nlobjSearchColumn('internalid'),
                new nlobjSearchColumn('enddate').setSort(false),
                new nlobjSearchColumn('periodname')
            ]
        );
        //SEARCHES - FOR LOOP THROUGH ALL THE BALANCE SHEET ACCOUNT GROUPS 
        var glAccountTop = ['Income', 'COGS', 'Expense', 'OthIncome', 'OthExpense'];
        var col = new Array();
        col[0] = new nlobjSearchColumn('formulatext', null, 'GROUP').setFormula('Income Statement');
        col[1] = new nlobjSearchColumn('account', null, 'GROUP');
        col[2] = new nlobjSearchColumn('accounttype', null, 'GROUP');
        col[3] = new nlobjSearchColumn('formulatext', null, 'GROUP').setFormula('CASE WHEN {accountingperiod.internalid} = ' + Number(request.getParameter('custpage_enddate')) + ' THEN CASE WHEN {accounttype} IN ("Income", "Cost of Goods Sold", "Expense", "Other Expense", "Other Income") THEN {account.name} ELSE {account.name} END ELSE {account.name} END');
        col[4] = new nlobjSearchColumn('name', 'account', 'GROUP');
        for (var i = 0; i < accountingperiodSearch.length; i++) {
            col[i + 5] = new nlobjSearchColumn('formulanumeric', null, 'SUM').setFormula('CASE WHEN {accountingperiod.internalid} = ' + Number(accountingperiodSearch[i].getValue('internalid')) + ' THEN NVL({debitamount},0)-NVL({creditamount},0) ELSE 0 END');
        }
        col[i + 5] = new nlobjSearchColumn('formulanumeric', null, 'SUM').setFormula('CASE WHEN {accountingperiod.internalid} between ' + startDate + ' and ' + endDate + ' THEN NVL({debitamount},0)-NVL({creditamount},0) ELSE 0 END');
        col[i + 6] = new nlobjSearchColumn('name', 'department', 'GROUP');
        //START OF FORM
        var form_SS = nlapiCreateForm(nlapiLoadConfiguration('companyinformation').getFieldValue('legalname') + ' Income Statement');
        //CREATING THE INCOME STATEMENT TAB
        form_SS.addSubTab('custpage_acct_tab', 'Income Statement');
        var ISList = form_SS.addSubList('custpage_bank_list', 'list', 'Bank Accounts', 'custpage_acct_tab');
        ISList.addField('custpage_class', 'text', 'Classification').setDisplaySize('15');
        ISList.addField('custpage_type', 'text', 'Type').setDisplaySize('20');
        ISList.addField('custpage_number', 'text', 'Number').setDisplaySize('10');
        ISList.addField('custpage_account', 'text', 'Description').setDisplaySize('20');
        ISList.addField('custpage_department', 'text', 'Division').setDisplaySize('20');
        for (var i = 0; i < accountingperiodSearch.length; i++) {
            ISList.addField('custpage_month_' + accountingperiodSearch[i].getValue('internalid'), 'currency', accountingperiodSearch[i].getValue('periodname')).setDisplaySize('10');
        }
        ISList.addField('custpage_total', 'currency', 'Total').setDisplaySize('10');
        //CREATING THE INCOME STATEMENT TAB
        form_SS.addSubTab('custpage_is_tab', 'Income Statement');
        var fTotals = {};
        for (var i = 0; i < accountingperiodSearch.length; i++) {
            fTotals[accountingperiodSearch[i].getValue('internalid')] = 0;
        }
		var tFilters = [];
		var iLP = 1;
        for (var iAC = 0; iAC < glAccountTop.length; iAC++) {
            var custpage_acctName = glAccountTop[iAC];
            if (divFilter) {
				tFilters.push(new nlobjSearchFilter('department', null, 'anyof', divFilter));
			}
			tFilters.push(new nlobjSearchFilter('accounttype', null, 'anyof', custpage_acctName));
			tFilters.push(new nlobjSearchFilter('posting', null, 'is', 'T'));
			tFilters.push(new nlobjSearchFilter('internalidnumber', 'account', 'isnotempty', null));
			tFilters.push(new nlobjSearchFilter('number', 'account', 'is not', '3100'));
			var thisSearch = nlapiSearchRecord('transaction', null, tFilters, col);
            var fLines = {};
            for (var i = 0; i < accountingperiodSearch.length; i++) {
                fLines[accountingperiodSearch[i].getValue('internalid')] = 0;
            }
            if (thisSearch && thisSearch.length > 0) {
                for (var iLZ = 0; iLZ < thisSearch.length; iLZ++) {
                    ISList.setLineItemValue('custpage_class', iLP, thisSearch[iLZ].getValue(col[0]));
                    ISList.setLineItemValue('custpage_number', iLP, thisSearch[iLZ].getValue(col[1]));
                    ISList.setLineItemValue('custpage_type', iLP, thisSearch[iLZ].getValue(col[2]));
                    ISList.setLineItemValue('custpage_account', iLP, thisSearch[iLZ].getValue(col[4]));
                    for (var i = 0; i < accountingperiodSearch.length; i++) {
                        if (thisSearch[iLZ].getValue(col[2]) == 'Income') {
                            ISList.setLineItemValue('custpage_month_' + accountingperiodSearch[i].getValue('internalid'), iLP, -thisSearch[iLZ].getValue(col[i + 5]));
                        } else {
                            ISList.setLineItemValue('custpage_month_' + accountingperiodSearch[i].getValue('internalid'), iLP, thisSearch[iLZ].getValue(col[i + 5]));
                        }
                        fLines[accountingperiodSearch[i].getValue('internalid')] += parseFloat(thisSearch[iLZ].getValue(col[i + 5]));
                    }
                    if (thisSearch[iLZ].getValue(col[2]) == 'Income') {
                        ISList.setLineItemValue('custpage_total', iLP, -thisSearch[iLZ].getValue(col[i + 5]));
                    } else {
                        ISList.setLineItemValue('custpage_total', iLP, thisSearch[iLZ].getValue(col[i + 5]));
                    }
                    ISList.setLineItemValue('custpage_department', iLP, thisSearch[iLZ].getValue(col[i + 6]));
                    iLP++;
                }
                ISList.setLineItemValue('custpage_class', iLP, '<B>****************</B>');
                ISList.setLineItemValue('custpage_type', iLP, '<B>****************</B>');
                ISList.setLineItemValue('custpage_number', iLP, '<B>****************</B>');
                ISList.setLineItemValue('custpage_department', iLP, '<B>****************</B>');
                ISList.setLineItemValue('custpage_account', iLP, '<B>Total ' + thisSearch[0].getValue(col[2]) + '</B>');
                for (var i = 0; i < accountingperiodSearch.length; i++) {
                    if (thisSearch[0].getValue(col[2]) == 'Income') {
                        ISList.setLineItemValue('custpage_month_' + accountingperiodSearch[i].getValue('internalid'), iLP, -fLines[accountingperiodSearch[i].getValue('internalid')]);
                        fTotals[accountingperiodSearch[i].getValue('internalid')] += -fLines[accountingperiodSearch[i].getValue('internalid')];
                    } else {
                        ISList.setLineItemValue('custpage_month_' + accountingperiodSearch[i].getValue('internalid'), iLP, fLines[accountingperiodSearch[i].getValue('internalid')]);
                        fTotals[accountingperiodSearch[i].getValue('internalid')] += -fLines[accountingperiodSearch[i].getValue('internalid')];
                    }

                }
                var fTotal = 0;
                for (var i = 0; i < accountingperiodSearch.length; i++) {
                    fTotal += parseFloat(ISList.getLineItemValue('custpage_month_' + accountingperiodSearch[i].getValue('internalid'), iLP));
                }
                ISList.setLineItemValue('custpage_total', iLP, fTotal);
                iLP++;
            }
        }
        //TOTALS
        ISList.setLineItemValue('custpage_class', iLP, '<B>****************</B>');
        ISList.setLineItemValue('custpage_type', iLP, '<B>****************</B>');
        ISList.setLineItemValue('custpage_number', iLP, '<B>****************</B>');
        var fGTotal = 0;
        for (var i = 0; i < accountingperiodSearch.length; i++) {
            ISList.setLineItemValue('custpage_month_' + accountingperiodSearch[i].getValue('internalid'), iLP, fTotals[accountingperiodSearch[i].getValue('internalid')]);
            fGTotal += fTotals[accountingperiodSearch[i].getValue('internalid')];
        }
        ISList.setLineItemValue('custpage_account', iLP, '<B>Net Income</B>');
        ISList.setLineItemValue('custpage_total', iLP, fGTotal);
        iLP++;
        //FINALIZE THE FORM AND DISPLAY
        response.writePage(form_SS);
    }
}