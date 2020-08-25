/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 * @format
 */

import React = require('react');
import {
  Button,
  Text,
  TextInput,
  View,
  TouchableHighlight,
  ScrollView,
} from 'react-native';
import {Popup} from 'react-native-windows';

interface IPopupExampleState {
  isFlyoutVisible: boolean;
  buttonTitle: string;
  touchCount: number;
}

class PopupExample extends React.Component<{}, IPopupExampleState> {
  // tslint:disable-next-line:no-any
  private _textInput: any;

  public state: IPopupExampleState = {
    isFlyoutVisible: false,
    buttonTitle: 'Open Popup',
    touchCount: 0,
  };

  public constructor(props: any) {
    super(props);
    this._textInput = React.createRef();
  }

  public render() {
    return (
      <View>
        <Text style={{width: 250}}>The following tests popup Anchor</Text>
        <View style={{flexDirection: 'row'}}>
          <Text style={{padding: 10, width: 300, height: 32}}>
            Text Input to Anchor popup to:{' '}
          </Text>
          <TextInput style={{height: 32, width: 300}} />
        </View>
        <View style={{justifyContent: 'center', padding: 50}}>
          <Button onPress={this._onPress} title={this.state.buttonTitle} />
        </View>
        {this.state.isFlyoutVisible && (
          <Popup
            isOpen={this.state.isFlyoutVisible}
            onDismiss={this._onPopupDismissed}
            target={this._textInput.current}
            isLightDismissEnabled={false}
            horizontalOffset={10}
            verticalOffset={10}>
            <View
              style={{backgroundColor: 'lightgray', width: 200, height: 300}}>
              <Text
                style={{
                  justifyContent: 'center',
                  paddingTop: 10,
                  paddingBottom: 30,
                }}>
                This is a popup
              </Text>
              <Button onPress={this._togglePopup} title="Close" />
              {this.state.touchCount > 0 && (
                <Text>I'm touched ({this.state.touchCount})</Text>
              )}
              <ScrollView>{this._renderTouchables()}</ScrollView>
            </View>
          </Popup>
        )}
      </View>
    );
  }

  _renderTouchables = () => {
    const touchables: JSX.Element[] = [];
    for (let i = 0; i < 10; i++) {
      touchables.push(
        <TouchableHighlight
          style={{
            paddingTop: 10,
            paddingBottom: 20,
            borderWidth: 1,
            borderColor: '#000000',
          }}
          onPress={this._highlightPressed}
          underlayColor={'rgb(210, 230, 255)'}>
          <View>
            <Text>Click on the touchable</Text>
          </View>
        </TouchableHighlight>,
      );
    }

    return touchables;
  };

  _togglePopup = () => {
    this.setState(state => ({
      buttonTitle: state.isFlyoutVisible ? 'Open Popup' : 'Close Popup',
      isFlyoutVisible: !state.isFlyoutVisible,
      touchCount: 0,
    }));
  };

  _onPopupDismissed = () => {
    this.setState({
      buttonTitle: 'Open Popup',
      isFlyoutVisible: false,
      touchCount: 0,
    });
  };

  _highlightPressed = () => {
    console.log('Touchable Highlight pressed');
    this.setState({touchCount: this.state.touchCount + 1});
  };

  _onPress = () => {
    this.setState({buttonTitle: 'Close Flyout', isFlyoutVisible: true});
  };

  _onPopupButtonPressed = () => {
    this.setState({buttonTitle: 'Open Flyout', isFlyoutVisible: false});
  };
}

export const displayName = (_undefined?: string) => {};
export const title = '<Popup>';
export const description =
  'Displays content on top of existing content, within the bounds of the application window.';
export const examples = [
  {
    title: 'Popup Anchor to text input',
    render: function(): JSX.Element {
      return <PopupExample />;
    },
  },
];
