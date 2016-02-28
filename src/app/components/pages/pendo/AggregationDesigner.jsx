import React from 'react'
import ReactDOM from 'react-dom'

import {
  Mixins,
  Toolbar, ToolbarGroup, ToolbarTitle,
  Paper,
  RaisedButton, FlatButton,
  Divider,
  DropDownMenu, MenuItem,
  Toggle,
  IconButton,
  Dialog,
  TextField,
} from 'material-ui'
import {ActionLaunch, ContentSave, ContentAddCircle} from 'material-ui/lib/svg-icons'
const {StylePropable, StyleResizable} = Mixins
import {Colors} from 'material-ui/lib/styles'

import brace from 'brace'
import AceEditor from 'react-ace'
import 'brace/mode/yaml'
import 'brace/mode/json'
import 'brace/theme/github'

import yaml from 'js-yaml'
import _ from 'lodash'

import request from '../../../api-request'

export default React.createClass({

  // Boilderplate and React lifecycle methods

  propTypes: {
    onChangeMuiTheme: React.PropTypes.func,
  },

  contextTypes: {
    muiTheme: React.PropTypes.object,
  },

  mixins: [StylePropable, StyleResizable],

  getInitialState() {
    return {
      mode: 'YAML',
      editorContents: '',
      name: '',
      analysisNames: [],
      aggregationResult: '',
      aggregationResultStatus: '',
      aggregationResultError: '',
      saved: true,
      duplicateButtonDisabled: true,
      duplicateDialogOpen: false,
      duplicateErrorText: '',
      manageAnalysisDialogOpen: false
    }
  },

  duplicateDialogOpen() {
    this.setState({duplicateDialogOpen: true})
  },

  duplicateDialogClose() {
    this.setState({duplicateDialogOpen: false})
  },

  componentDidMount() {
    ReactDOM.findDOMNode(this.refs.editor).children[0].focus()
    this.serverRequest = request(`/api/analysis`, (err, result) => {
      if (err) {
        console.log('Error retrieving list of analysis. Replace with some sort of flair or toast.')
      } else {
        this.setState({
          analysisNames: result.body,
          name: result.body[0],
        })
      }
      this.getAnalysis(result.body[0])
    })
  },

  componentWillUnmount() {
    if (this.serverRequest) {
      this.serverRequest.abort()
    }
  },

  // Helpers

  getStyles() {
    return {
      buttons: {
        marginLeft: "5px",
        marginTop: "10px",
      },
      resultBar: {
        color: this.context.muiTheme.rawTheme.palette.textColor,
      },
      dropDown: {
        width: "150px",
        marginRight: 0,
        color: this.context.muiTheme.rawTheme.palette.textColor,
      },
    }
  },

  // Event handlers

  onChangeMode(event) {
    let newMode
    if (this.state.mode === 'JSON') {
      newMode = 'YAML'
    } else if (this.state.mode === 'YAML') {
      newMode = 'JSON'
    }
    this.reformat(undefined, undefined, undefined, undefined, newMode)
  },

  runAggregation() {
    let body = yaml.safeLoad(this.state.editorContents)
    request('/api/aggregation', body, (err, result) => {
      if (err) {
        this.setState({
          aggregationResult: err.message,
          aggregationResultStatus: err.status,
        })
      } else {
        let aggregationResult
        if (this.state.mode === 'YAML') {
          aggregationResult = yaml.safeDump(result.body)
        } else {
          aggregationResult = JSON.stringify(result.body, null, 2)
        }
        this.setState({
          aggregationResult: aggregationResult,
          aggregationResultStatus: result.status,
        })
      }
    })
  },

  postAnalysis(newName) {
    if (newName) {
      let newAnalysisNames = this.state.analysisNames.concat(newName)
      this.setState({
        name: newName,
        analysisNames: newAnalysisNames,
      })
    } else {
      newName = this.state.name
    }
    let spec = {
      aggregationResult: this.state.aggregationResult,
      aggregtionResultError: this.state.aggregationResultError,
      aggregationResultStatus: this.state.aggregationResultStatus,
    }
    try {
      spec.editorContentsJSONString = JSON.stringify(yaml.safeLoad(this.state.editorContents), null, 2)
    } catch (e) {
      spec.editorContentsJSONString = this.state.editorContents
    }
    request(`/api/analysis/${newName}`, spec, (err, result) => {
      if (err) {
        console.log(err)  // TODO: Replace with flair or toast
        this.setState({
          saved: false,
        })
      } else {
        this.setState({
          saved: true,
        })
      }
    })
  },

  saveAnalysis() {
    if (! this.state.saved) {
      this.postAnalysis()
    }
  },

  reformat(newEditorContents = this.state.editorContents,
           newAggregationResult = this.state.aggregationResult,
           newAggregationResultStatus = this.state.aggregationResultStatus,
           newAggregationResultError = this.state.aggregationResultError,
           newMode = this.state.mode,
           newName = this.state.name) {
    let aggregationResultAsObject, editorContentsAsObject
    try {
      editorContentsAsObject = yaml.safeLoad(newEditorContents)
    } catch (e) {}
    try {
      aggregationResultAsObject = yaml.safeLoad(newAggregationResult)
    } catch (e) {}
    if (newMode === 'YAML') {
      if (editorContentsAsObject) {
        newEditorContents = yaml.safeDump(editorContentsAsObject)
      }
      if (aggregationResultAsObject) {
        newAggregationResult = yaml.safeDump(aggregationResultAsObject)
      }
    } else {
      if (editorContentsAsObject) {
        newEditorContents = JSON.stringify(editorContentsAsObject, null, 2)
      }
      if (aggregationResultAsObject) {
        newAggregationResult = JSON.stringify(aggregationResultAsObject, null, 2)
      }
    }
    this.setState({
      saved: false,
      editorContents: newEditorContents,
      aggregationResult: newAggregationResult,
      aggregationResultStatus: newAggregationResultStatus,
      aggregationResultError: newAggregationResultError,
      mode: newMode,
      name: newName,
    })
  },

  onTimeout() {
    this.reformat(this.newValue)
    this.timeout = false
    this.pastePending = false
    delete this.newValue
  },

  onChangeEditorContents(newValue) {
    if (this.pastePending) {  // assumes the onPaste event is called before this onChange handler
      // Below debounces calls to this onChange handler since pastes often result in multiple onChange events
      this.newValue = newValue
      if (this.timeout) {
        clearTimeout(this.timeout)
        this.timeout = setTimeout(this.onTimeout, 5)
      } else {
        this.timeout = setTimeout(this.onTimeout, 5)
      }
    } else {
      this.setState({
        editorContents: newValue,
        saved: false,
      })
    }
  },

  onPaste() {
    this.pastePending = true
  },

  getAnalysis(name) {
    request(`/api/analysis/${name}`, (err, result) => {
      if (err) {
        console.log(err)  // TODO: Replace with flair or toast
      } else {
        let body = JSON.parse(result.body)
        this.reformat(body.editorContentsJSONString, body.aggregationResult, body.aggregationResultStatus, body.aggregationResultError, undefined, name)
        this.setState({
          saved: true
        })
      }
    })
  },

  duplicateAnalysis() {
    let newName = _.trim(this.refs.newName.getValue())
    this.postAnalysis(newName)
    this.setState({
      duplicateDialogOpen: false,
      duplicateButtonDisabled: false,
    })
  },

  onDropDownChange(e, index, value) {
    if (value === "+++MANAGE_ANALYSIS+++") {
      console.log('got here')
      this.setState({
        manageAnalysisDialogOpen: true
      })
    } else {
      this.getAnalysis(value)
    }
  },

  onNameChange(event) {
    let newName = _.trim(this.refs.newName.getValue())
    let newDuplicateButtonDisabled, newDuplicateErrorText
    if (_.includes(this.state.analysisNames, newName)) {
      newDuplicateButtonDisabled = true
      newDuplicateErrorText = 'An analysis by this name already exists'
    } else if (newName.length === 0) {
      newDuplicateErrorText = 'Required'
      newDuplicateButtonDisabled = true
    } else {
      newDuplicateErrorText = ''
      newDuplicateButtonDisabled = false
    }
    this.setState({
      duplicateButtonDisabled: newDuplicateButtonDisabled,
      duplicateErrorText: newDuplicateErrorText,
    })
  },

  render() {
    const dialogActions = [
      <FlatButton
        label="Cancel"
        secondary={true}
        onTouchTap={this.duplicateDialogClose}
        style={{marginRight: 5}}
      />,
      <RaisedButton
        label="Duplicate"
        primary={true}
        keyboardFocused={false}
        disabled={this.state.duplicateButtonDisabled}
        onTouchTap={this.duplicateAnalysis}
      />,
    ]
    let styles = this.getStyles()
    let savedColor, savedTooltip
    if (this.state.saved) {
      savedColor = this.context.muiTheme.rawTheme.palette.accent2Color
      savedTooltip = ""
    } else {
      savedColor = this.context.muiTheme.rawTheme.palette.primary1Color
      savedTooltip = "Save"
    }
    let defaultToggled, mode
    if (this.state.mode === 'JSON') {
      defaultToggled = false
      mode = 'json'
    } else {
      defaultToggled = true
      mode = 'yaml'
    }
    return (
      <Paper zDepth={5}>
        <Toolbar>
          <IconButton firstChild={true} style={{marginTop: 3, marginLeft: 0, width: 40, float: 'left'}} tooltip="Run" tooltipPosition="top-center" onTouchTap={this.runAggregation}>
            <ActionLaunch />
          </IconButton>
          <ToolbarGroup float="left">
            <Toggle
              labelStyle={{marginRight: 0}}
              label={this.state.mode}
              defaultToggled={defaultToggled}
              onToggle={this.onChangeMode}
              style={{marginTop: 15, marginLeft: 10, width: '80px'}}
              thumbStyle={{backgroundColor: Colors.grey300}} />
          </ToolbarGroup>
          <ToolbarGroup lastChild={true} float="right">
            <DropDownMenu labelStyle={styles.dropDown} style={{marginRight: 0}} value={this.state.name} onChange={this.onDropDownChange}>
              {this.state.analysisNames.map((analysisName, index) => {
                return (<MenuItem key={index} value={analysisName} primaryText={analysisName} />)
              })}
              <Divider />
              <MenuItem key={-1} value={"+++MANAGE_ANALYSIS+++"} primaryText={"Manage analysis..."} />
            </DropDownMenu>
            <IconButton style={{marginTop: 3, marginLeft: 0, marginRight: 0, width: 40, float: 'left'}} tooltip="Duplicate as..." tooltipPosition="top-center" onTouchTap={this.duplicateDialogOpen}>
              <ContentAddCircle />
            </IconButton>
            <IconButton style={{marginTop: 3, marginLeft: 0, marginRight: 0}} tooltip={savedTooltip} tooltipPosition="top-center" onTouchTap={this.saveAnalysis}>
              <ContentSave color={savedColor} />
            </IconButton>
          </ToolbarGroup>
        </Toolbar>
        <AceEditor
          ref="editor"
          mode={mode}
          value={this.state.editorContents}
          theme="github"
          name="editor"
          width="100%"
          showPrintMargin={false}
          editorProps={{$blockScrolling: Infinity}}
          onChange={this.onChangeEditorContents}
          onBlur={this.saveAnalysis}
          onPaste={this.onPaste}
          tabSize={2}/>
        <Toolbar style={styles.resultBar}>
          <ToolbarTitle text={"Result: " + this.state.aggregationResultStatus} />
        </Toolbar>
        <AceEditor
          mode={mode}
          value={this.state.aggregationResult}
          theme="github"
          name="result"
          width="100%"
          readOnly={true}
          showPrintMargin={false}
          editorProps={{$blockScrolling: true}}
          tabSize={2} />
        <Dialog
          title="Duplicate analysis"
          actions={dialogActions}
          modal={false}
          open={this.state.duplicateDialogOpen}
          onRequestClose={this.duplicateDialogClose}
          contentStyle={{width: 300}}
        >
          <TextField
            hintText="Name for duplicated analysis"
            floatingLabelText="Name"
            defaultValue={this.state.name}
            onChange={this.onNameChange}
            errorText={this.state.duplicateErrorText}
            ref="newName"
          />
        </Dialog>
      </Paper>
    )
  }
})
